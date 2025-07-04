'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import CharacterNetwork from './CharacterNetwork';
import AnalysisModeToggle from '@/components/ui/AnalysisModeToggle';
import { toast } from 'sonner';
import InteractionList from './InteractionList';
import { Slider } from '@/components/ui/slider';

// ts types mirroring modal

interface AnalysisRequestBody {
    gutenberg_id: number;
    analysis_type: string;
    max_chunks?: number;
}

export interface Metadata {
    Author: string;
    Title?: string;
    error?: string;
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
    const [bookId, setBookId] = useState('');
    const [analysisMode, setAnalysisMode] = useState('llm');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [nodes, setNodes] = useState<graphNode[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [showAll, setShowAll] = useState(false);
    const [maxChunks, setMaxChunks] = useState(5);

    const [metaDataa, setMetaDataa] = useState<Metadata>();
    const [isLoadingMetaData, setIsLoadingMetaData] = useState(false);

    // show toast of meta data
    useEffect(() => {
        if (metaDataa) {
            toast(metaDataa.Title || 'Unknown Title', {
                position: 'top-center',
                duration: 4000,
            });
        }
    }, [metaDataa]);

    const getMetaData = async () => {
        if (!bookId.trim()) return;

        setIsLoadingMetaData(true);
        setError(null);

        try {
            const body: AnalysisRequestBody = {
                gutenberg_id: parseInt(bookId),
                analysis_type: 'metadata',
            };

            const r = await fetch(
                process.env.NEXT_PUBLIC_MODAL_ENDPOINT ??
                    'https://mhafez6--llm-idea-analyze-book.modal.run',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }
            );

            const data: Metadata = await r.json();

            if (!r.ok || data.error) {
                throw new Error(data.error ?? `HTTP ${r.status}`);
            }

            setMetaDataa(data);
        } catch (error) {
            setError((error as Error).message);
        } finally {
            setIsLoadingMetaData(false);
        }
    };

    const handleAnalyze = async () => {
        if (!bookId.trim()) return;

        setIsLoading(true);
        setError(null);
        setShowResults(false);

        try {
            const body: AnalysisRequestBody = {
                gutenberg_id: parseInt(bookId),
                analysis_type: analysisMode,
                max_chunks: maxChunks,
            };

            const res = await fetch(
                process.env.NEXT_PUBLIC_MODAL_ENDPOINT ??
                    'https://mhafez6--llm-idea-analyze-book.modal.run',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                        {analysisMode === 'llm' && (
                            <div className="space-y-2">
                                <Label htmlFor="chunk-size">
                                    Analysis Depth (chunks)
                                    <span className="ml-2 text-sm text-muted-foreground">
                                        (~{maxChunks * 1.5} pages)
                                    </span>
                                </Label>
                                <div className="flex items-center gap-4">
                                    <Slider
                                        id="chunk-size"
                                        min={3}
                                        max={15}
                                        step={1}
                                        value={[maxChunks]}
                                        onValueChange={(vals: number[]) => setMaxChunks(vals[0])}
                                        className="flex-1"
                                    />
                                    <span className="w-12 text-center">{maxChunks}</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    More chunks = deeper analysis but slower processing
                                </p>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row gap-2">
                        <Button
                            onClick={handleAnalyze}
                            disabled={isLoading || !bookId}
                            className="flex-1"
                        >
                            {isLoading ? 'Analyzing...' : 'Analyze Book'}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={getMetaData}
                            disabled={isLoadingMetaData || !bookId}
                            className="flex-1"
                        >
                            {isLoadingMetaData ? 'Fetching...' : 'Get Meta Data'}
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
                                            {showAll ? 'Show Top 5' : `Show All (${nodes.length})`}
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

                {showResults ? (
                    <>
                        <InteractionList edges={edges} nodes={nodes} />
                    </>
                ) : (
                    <></>
                )}
            </div>
        </div>
    );
}
