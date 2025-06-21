import React from 'react';
import { Props } from './CharacterNetwork';

// export interface Props {
// 	nodes: { name: string; count: number }[];
// 	edges: { source: string; target: string; weight: number }[];
//   }

interface InteractedWith {
    interaction: { name: string; weight: number }[];
}

const InteractionList = ({ nodes, edges }: Props) => {
    const chars = nodes.map((n) => {
        const temp_n: InteractedWith = { interaction: [] };

        for (let i = 0; i < edges.length; i++) {
            if (edges[i].source == n.name) {
                temp_n.interaction.push({
                    name: edges[i].target,
                    weight: edges[i].weight,
                });
            } else if (edges[i].target == n.name) {
                temp_n.interaction.push({
                    name: edges[i].source,
                    weight: edges[i].weight,
                });
            }
        }
        temp_n.interaction.sort((a, b) => b.weight - a.weight);
        temp_n.interaction = temp_n.interaction.slice(0, 5);

        return {
            name: n.name,
            ...temp_n,
        };
    });
    chars.sort((a, b) => {
        const totalA = a.interaction.reduce((sum, int) => sum + int.weight, 0);
        const totalB = b.interaction.reduce((sum, int) => sum + int.weight, 0);
        return totalB - totalA;
    });

    return (
        <div className="space-y-2 p-4">
            {chars.slice(0, 5).map((char, idx) => (
                <div key={idx} className="font-mono text-sm">
                    <span className='font-bold'>{char.name}-{' '}</span>
                    {char.interaction.map((int) => `${int.name}:${int.weight}`).join(', ')}
                </div>
            ))}
        </div>
    );
};

export default InteractionList;
