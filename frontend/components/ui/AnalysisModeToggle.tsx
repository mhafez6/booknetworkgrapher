import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Zap, LucideIcon } from 'lucide-react';

interface AnalysisMode {
    id: string;
    label: string;
    description: string;
    icon: LucideIcon;
    badge?: string;
}

interface AnalysisModeToggleProps {
    selectedMode?: string;
    onModeChange?: (mode: string) => void;
    modes?: AnalysisMode[];
}

const AnalysisModeToggle: React.FC<AnalysisModeToggleProps> = ({
    selectedMode = 'llm',
    onModeChange = () => {},
    modes = [
        {
            id: 'llm',
            label: 'LLM',
            description:
                'Weighted network graph of character interactions over a subset of the book.',
            icon: Brain,
            badge: 'Recommended',
        },
        {
            id: 'spacy',
            label: 'spaCy NER',
            description:
                'Named Entity Recognition model that counts character occurences over whole book. ',
            icon: Zap,
            badge: 'Possible innaccuracies ',
        },
    ],
}) => {
    const [selected, setSelected] = useState(selectedMode);

    const handleModeSelect = (modeId: string) => {
        setSelected(modeId);
        onModeChange(modeId);
    };

    return (
        <div className="w-full max-w-xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {modes.map((mode) => (
                    <Card
                        key={mode.id}
                        className={`relative cursor-pointer transition-all duration-200 hover:shadow-md ${
                            selected === mode.id
                                ? 'ring-2 ring-primary bg-primary/5 border-primary'
                                : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => handleModeSelect(mode.id)}
                    >
                        <div className="p-3">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div
                                        className={`p-1.5 rounded-lg ${
                                            selected === mode.id
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted text-muted-foreground'
                                        }`}
                                    >
                                        <div
                                            className={`p-1.5 rounded-lg ${
                                                selected === mode.id
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted text-muted-foreground'
                                            }`}
                                        >
                                            <mode.icon className="w-4 h-4" />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-foreground">
                                            {mode.label}
                                        </h3>
                                        {mode.badge && (
                                            <Badge
                                                variant="secondary"
                                                className="mt-0.5 text-[10px] px-1.5 py-0.5"
                                            >
                                                {mode.badge}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div
                                    className={`w-3 h-3 rounded-full border-2 transition-all ${
                                        selected === mode.id
                                            ? 'border-primary bg-primary'
                                            : 'border-muted-foreground'
                                    }`}
                                >
                                    {selected === mode.id && (
                                        <div className="w-full h-full rounded-full bg-primary-foreground scale-50" />
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground leading-snug">
                                {mode.description}
                            </p>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default AnalysisModeToggle;
