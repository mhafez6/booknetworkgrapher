"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";


interface Props {
  nodes: { name: string; count: number }[];
  edges: { source: string; target: string; weight: number }[];
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  count: number;
  x?: number;
  y?: number;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
  weight: number;
}

export default function CharacterNetwork({ nodes, edges }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    const width = 800;
    const height = 600;
    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .attr("width", width)
      .attr("height", height);

    // Create zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom as any);

    // Main container
    const container = svg.append("g");

    // Calculate edge weight range for thickness scaling
    const minWeight = Math.min(...edges.map((e) => e.weight));
    const maxWeight = Math.max(...edges.map((e) => e.weight));
    const weightScale = d3
      .scaleLinear()
      .domain([minWeight, maxWeight])
      .range([1, 8]);

    // Calculate node size based on mention count
    const minCount = Math.min(...nodes.map((n) => n.count));
    const maxCount = Math.max(...nodes.map((n) => n.count));
    const nodeScale = d3
      .scaleLinear()
      .domain([minCount, maxCount])
      .range([8, 20]);

    // Prepare data
    const graphNodes: D3Node[] = nodes.map((n) => ({
      id: n.name,
      count: n.count,
    }));

    const graphLinks: D3Link[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));

    // Create simulation
    const simulation = d3
      .forceSimulation<D3Node>(graphNodes)
      .force(
        "link",
        d3
          .forceLink<D3Node, D3Link>(graphLinks)
          .id((d: any) => d.id)
          .distance((d) => 80 + (1 / d.weight) * 50) // Closer nodes for stronger connections
          .strength(0.5)
      )
      .force("charge", d3.forceManyBody().strength(-300).distanceMax(200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide().radius((node: any) => {
          const d = node as D3Node;
          return nodeScale(d.count) + 5;
        })
      );

    // Create links
    const link = container
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(graphLinks)
      .join("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => weightScale(d.weight));

    // Create nodes group
    const nodeGroup = container
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(graphNodes)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer");

    // Add drag functionality
    const handleDrag = d3
      .drag<SVGGElement, D3Node>()
      .on("start", function (event, d: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", function (event, d: any) {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", function (event, d: any) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeGroup.call(handleDrag as any);

    // Add circles to nodes
    nodeGroup
      .append("circle")
      .attr("r", (d) => nodeScale(d.count))
      .attr("fill", (d, i) => d3.schemeCategory10[i % 10])
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Add labels to nodes (initially hidden)
    const nodeLabels = nodeGroup
      .append("text")
      .text((d) => d.id)
      .attr("x", 0)
      .attr("y", (d) => nodeScale(d.count) + 15)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .attr("fill", "#333")
      .attr("pointer-events", "none")
      .style("opacity", 0);

    // Add mention count as small text (initially hidden)
    const nodeCounts = nodeGroup
      .append("text")
      .text((d) => `(${d.count})`)
      .attr("x", 0)
      .attr("y", (d) => nodeScale(d.count) + 28)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#666")
      .attr("pointer-events", "none")
      .style("opacity", 0);

    // Add interactivity
    nodeGroup
      .on("mouseover", function (event, d) {
        // Highlight connected nodes and edges
        const connectedNodes = new Set<string>();
        const connectedLinks = new Set<D3Link>();

        graphLinks.forEach((l) => {
          const sourceId =
            typeof l.source === "string" ? l.source : l.source.id;
          const targetId =
            typeof l.target === "string" ? l.target : l.target.id;

          if (sourceId === d.id || targetId === d.id) {
            connectedNodes.add(sourceId);
            connectedNodes.add(targetId);
            connectedLinks.add(l);
          }
        });

        // Dim non-connected elements
        nodeGroup.style("opacity", (n) => (connectedNodes.has(n.id) ? 1 : 0.3));
        link.style("opacity", (l) => (connectedLinks.has(l) ? 1 : 0.1));

        // Highlight the hovered node
        d3.select(this)
          .select("circle")
          .attr("stroke", "#ff6b6b")
          .attr("stroke-width", 3);

        // Show labels for connected nodes
        nodeLabels.style("opacity", (n) => (connectedNodes.has(n.id) ? 1 : 0));
        nodeCounts.style("opacity", (n) => (connectedNodes.has(n.id) ? 1 : 0));
      })
      .on("mouseout", function () {
        // Reset opacity
        nodeGroup.style("opacity", 1);
        link.style("opacity", 0.6);

        // Reset stroke
        d3.select(this)
          .select("circle")
          .attr("stroke", "#fff")
          .attr("stroke-width", 2);

        // Hide all labels
        nodeLabels.style("opacity", 0);
        nodeCounts.style("opacity", 0);
      });

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as D3Node).x!)
        .attr("y1", (d) => (d.source as D3Node).y!)
        .attr("x2", (d) => (d.target as D3Node).x!)
        .attr("y2", (d) => (d.target as D3Node).y!);

      nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, edges]);

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-sm text-gray-600">
          Hover over nodes to see character names • Drag to move • Scroll to
          zoom
        </span>
      </div>

      {/* Network Graph */}
      <div className="w-full h-[600px] border rounded-lg overflow-hidden bg-white">
        <svg ref={svgRef} className="w-full h-full" />
      </div>
    </div>
  );
}
