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
import { Badge } from "@/components/ui/badge";
import CharacterNetwork from "./CharacterNetwork";
import AnalysisModeToggle from "@/components/ui/AnalysisModeToggle";
// import BookMetadata from "./BookMetadata";

// ts types mirroring modal

interface AnalysisRequestBody {
  gutenberg_id: number;
  analysis_type: string;
}

export interface AnalysisResponseBody {
  book_id: number;
  nodes: {
    name: string;
    count: number;
  }[];
  edges: {
    source: string;
    target: string;
    weight: number;
  }[];
  error?: string;
}

type graphNode = { name: string; count: number };
type Edge = { source: string; target: string; weight: number };

export function BookAnalyzer() {
  const [bookId, setBookId] = useState("");
  const [analysisMode, setAnalysisMode] = useState("llm");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [nodes, setNodes] = useState<graphNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
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
          "https://mhafez6--llm-idea-analyze-book.modal.run",
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

      const resNode: graphNode[] = data.nodes.map(({ name, count }) => ({
        name,
        count,
      }));

      const resEdges: Edge[] = data.edges.map(({ source, target, weight }) => ({
        source,
        target,
        weight,
      }));

      setEdges(resEdges);
      setNodes(resNode);
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
      <div className="relative">
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
              <AnalysisModeToggle
                selectedMode={analysisMode}
                onModeChange={setAnalysisMode}
              />
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
      </div>

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
                  {(showAll ? nodes : nodes.slice(0, 5)).map(
                    (char: graphNode) => (
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
                {nodes.length > 5 && (
                  <div className="mt-4 text-center">
                    <Button
                      variant="ghost"
                      onClick={() => setShowAll(!showAll)}
                      className="text-sm"
                    >
                      {showAll ? "Show Top 5" : `Show All (${nodes.length})`}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Character Network Graph</CardTitle>
                <CardDescription></CardDescription>
              </CardHeader>
              <CardContent>
                <CharacterNetwork edges={edges} nodes={nodes} />
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
