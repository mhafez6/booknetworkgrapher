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


// Mock data for character list
const mockCharacterData = [
  { name: "Alice", count: 15, gender: "Female" },
  { name: "The White Rabbit", count: 10, gender: "Male" },
  { name: "The Queen of Hearts", count: 8, gender: "Female" },
  { name: "The Mad Hatter", count: 12, gender: "Male" },
  { name: "The Cheshire Cat", count: 9, gender: "Male" },
];

export function BookAnalyzer() {
  const [bookUrl, setBookUrl] = useState(
    ""
  );
  const [analysisMode, setAnalysisMode] = useState("spacy");
  const [isLoading, setIsLoading] = useState(false);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    setShowResults(false);


    await new Promise((resolve) => setTimeout(resolve, 2000));

    setGraphData({ nodes: [], links: [] }); // Placeholder for graph
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
              value={bookUrl}
              onChange={(e) => setBookUrl(e.target.value)}
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
            disabled={isLoading || !bookUrl}
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
                  {mockCharacterData.map((char) => (
                    <li
                      key={char.name}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
                    >
                      <span className="font-medium">{char.name}</span>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">{char.gender}</Badge>
                        <Badge variant="secondary">
                          Mentioned {char.count} times
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
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
                <CharacterNetwork data={graphData} />
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
      </div>
    </div>
  );
}
