"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface BookMetadataProps {
  bookId: number;
  characters?: [string, number][];
  onCharactersFiltered?: (filtered: [string, number][]) => void;
}

interface ParsedMetadata {
  title: string;
  author: string;
  language?: string;
  wordCount?: number;
}

// Helper function to filter characters using Groq
async function filterCharactersWithLLM(
  characters: [string, number][],
  title: string,
  author: string
): Promise<[string, number][]> {
  const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    console.warn(
      "[filterCharactersWithLLM] GROQ_API_KEY missing - skipping LLM filtering"
    );
    return characters;
  }

  // Format character list for the prompt
  const characterList = characters
    .map(([name, count]) => `- ${name}: ${count}`)
    .join("\n");

  const systemPrompt =
    "You are a literary expert. Given a list of names automatically extracted " +
    "from a novel, identify which items are *not* actual characters in the story. " +
    "Typical false positives include words like 'Project Gutenberg', 'Chapter', " +
    "numbers, and author/publisher information.";

  const userPrompt =
    `Book title: ${title}\n` +
    `Author: ${author}\n\n` +
    "Here is the extracted list (name: mention_count). Remove any entries that are " +
    "not real character names. Return *only* a JSON array of 2-item arrays where " +
    "each inner array is [name, count]. Do not wrap it in markdown, do not add " +
    `any other keys.\n\n${characterList}`;

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mixtral-8x7b-32768",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0,
          max_tokens: 1024,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    // Parse the JSON response
    const cleaned = JSON.parse(content) as [string, number][];

    // Validate the structure
    if (
      Array.isArray(cleaned) &&
      cleaned.every(
        (item) =>
          Array.isArray(item) &&
          item.length === 2 &&
          typeof item[0] === "string" &&
          typeof item[1] === "number"
      )
    ) {
      return cleaned;
    }

    console.warn(
      "[filterCharactersWithLLM] Unexpected response schema, returning original list"
    );
    return characters;
  } catch (error) {
    console.error("[filterCharactersWithLLM] Error:", error);
    return characters;
  }
}

export default function BookMetadata({
  bookId,
  characters,
  onCharactersFiltered,
}: BookMetadataProps) {
  const [data, setData] = useState<ParsedMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) return;

    const controller = new AbortController();
    const fetchMeta = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const metaUrl = `https://www.gutenberg.org/ebooks/${bookId}`;
        const metaRes = await fetch(metaUrl, { signal: controller.signal });
        if (!metaRes.ok) throw new Error(`HTTP ${metaRes.status}`);
        const html = await metaRes.text();

        const titleMatch = html.match(/<title>(.*?)\|/i);
        const authorMatch = html.match(/<meta name="author" content="(.*?)"/i);

        const metadata = {
          title: titleMatch ? titleMatch[1].trim() : `Book #${bookId}`,
          author: authorMatch ? authorMatch[1] : "Unknown",
        };

        setData(metadata);

        // If we have characters to filter and a callback
        if (characters && characters.length > 0 && onCharactersFiltered) {
          const filteredChars = await filterCharactersWithLLM(
            characters,
            metadata.title,
            metadata.author
          );
          onCharactersFiltered(filteredChars);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeta();
    return () => controller.abort();
  }, [bookId, characters, onCharactersFiltered]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Book Metadata</CardTitle>
        <CardDescription>
          Basic information fetched from Gutendex API (Project Gutenberg
          metadata)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {data && !isLoading && !error && (
          <div className="space-y-2">
            <h4 className="text-lg font-semibold">{data.title}</h4>
            <p className="text-sm text-muted-foreground">
              Author: {data.author}
            </p>
            {data.wordCount && (
              <p className="text-sm text-muted-foreground">
                Approx. word count: {data.wordCount.toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
