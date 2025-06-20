"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import CharacterNetwork from "./CharacterNetwork";
// import BookMetadata from "./BookMetadata";

// ts types mirroring modal

interface AnalysisRequestBody {
  gutenberg_id: number;
  analysis_type: string;
}

interface AnalysisResponseBody {
  book_id: number;
  characters: [string, number][];
  error?: string;
}

type Character = { name: string; count: number };

// --- -- - - -- - - - - - - -
// react stuff

export function BookAnalyzer() {
  const [bookId, setBookId] = useState("");
  const [analysisMode, setAnalysisMode] = useState("spacy");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showAll, setShowAll] = useState(false);

  const handleAnalyze = async () => {
    if (!bookId.trim()) return;

    setIsLoading(true);
    setError(null);
    setShowResults(false);

    try {
      const body: AnalysisRequestBody = {
        gutenberg_id: parseInt(bookId),
        analysis_type: analysisMode,
      };

      const res = await fetch(
        process.env.NEXT_PUBLIC_MODAL_ENDPOINT ??
          "https://mhafez6--book-ner-analyze-book.modal.run",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const data: AnalysisResponseBody = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const updatedData: Character[] = data.characters.map(([name, count]) => ({
        name,
        count,
      }));

      setCharacters(updatedData);
      setShowResults(true);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setIsLoading(false);
    }

    setShowResults(true);
    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Analysis Configuration</CardTitle>
          <CardDescription>
            Enter a gutenberg ID and choose an analysis method.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="book-url">Project Gutenberg Book Id</Label>
            <Input
              id="book-url"
              placeholder="1342 (Pride & Prejudice)"
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Analysis Mode</Label>
            <RadioGroup
              defaultValue="spacy"
              className="flex items-center space-x-4"
              value={analysisMode}
              onValueChange={setAnalysisMode}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="spacy" id="spacy" />
                <Label htmlFor="spacy">spaCy (Fast)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="llm" id="llm" />
                <Label htmlFor="llm">LLM (Deep)</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleAnalyze}
            disabled={isLoading || !bookId}
            className="w-full"
          >
            {isLoading ? "Analyzing..." : "Analyze Book"}
          </Button>
        </CardFooter>
      </Card>

      {error && (
        <Card className="bg-destructive text-destructive-foreground">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {showResults ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Character List</CardTitle>
                <CardDescription>
                  A list of characters found in the book.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(showAll ? characters : characters.slice(0, 5)).map(
                    (char) => (
                      <li
                        key={char.name}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
                      >
                        <span className="font-medium">{char.name}</span>
                        <div className="flex items-center gap-4">
                          <Badge variant="secondary">
                            Mentioned {char.count} times
                          </Badge>
                        </div>
                      </li>
                    )
                  )}
                </ul>
                {characters.length > 5 && (
                  <div className="mt-4 text-center">
                    <Button
                      variant="ghost"
                      onClick={() => setShowAll(!showAll)}
                      className="text-sm"
                    >
                      {showAll
                        ? "Show Top 5"
                        : `Show All (${characters.length})`}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Character Network Graph</CardTitle>
                <CardDescription>
                  A visual representation of character interactions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CharacterNetwork />
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="flex items-center justify-center h-full min-h-[60vh]">
            <CardContent className="text-center">
              <p className="text-muted-foreground">
                Analysis results will be displayed here.
              </p>
            </CardContent>
          </Card>
        )}
        {/* {showResults && <BookMetadata bookId={Number(bookId)} />} */}
      </div>
    </div>
  );
}
