"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface Props {
  nodes: { name: string; count: number }[];
  edges: { source: string; target: string; weight: number }[];
}

interface GraphData {
  nodes: { id: string }[];
  links: { source: string; target: string; value: number }[];
}

export default function CharacterNetwork({ nodes, edges }: Props) {
  const maxWeight = useMemo(
    () => Math.max(...edges.map((e) => e.weight)),
    [edges]
  );
  const minWeight = useMemo(
    () => Math.min(...edges.map((e) => e.weight)),
    [edges]
  );

  const data = useMemo<GraphData>(
    () => ({
      nodes: nodes.map((n) => ({
        id: n.name,
      })),
      links: edges.map((e) => ({
        source: e.source,
        target: e.target,
        value: e.weight,
      })),
    }),
    [nodes, edges]
  );

  const getEdgeColor = (weight: number) => {
    const normalizedWeight = (weight - minWeight) / (maxWeight - minWeight);
    const blue = Math.round(255 * (1 - normalizedWeight));
    const red = Math.round(255 * normalizedWeight);
    return `rgb(${red}, 0, ${blue})`;
  };

  return (
    <div className="w-full h-[600px] border rounded-lg">
      <ForceGraph2D
        graphData={data}
        nodeAutoColorBy="id"
        nodeVal={5}
        linkColor={(link) => getEdgeColor(link.value)}
        linkWidth={2}
        nodeLabel={(node) =>
          `${node.id} (${nodes.find((n) => n.name === node.id)?.count || 0})`
        }
        width={800}
        height={600}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        d3VelocityDecay={0.1}
        cooldownTime={15000}
        warmupTicks={100}
        onNodeHover={(node) => {
          document.body.style.cursor = node ? "pointer" : "default";
        }}
      />
    </div>
  );
}
