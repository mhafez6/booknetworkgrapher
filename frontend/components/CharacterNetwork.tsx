import dynamic from 'next/dynamic'
import { useMemo } from 'react'

const ForceGraph2D = dynamic(
  () => import('react-force-graph').then((m) => m.ForceGraph2D),
  { ssr: false }
)

type Node = { name: string; count: number }
type Edge = { source: string; target: string; weight: number }

export default function NetworkGraph({
  nodes,
  edges,
}: {
  nodes: Node[]
  edges: Edge[]
}) {
  const data = useMemo(
    () => ({
      nodes: nodes.map((n) => ({
        id: n.name,
        val: n.count,
      })),
      links: edges.map((e) => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
      })),
    }),
    [nodes, edges]
  )

  return (
    <ForceGraph2D
      graphData={data}
      nodeAutoColorBy="id"
      linkDirectionalParticles={2}
      linkDirectionalParticleSpeed={(d) => (d.weight ?? 1) * 0.002}
      nodeLabel={(node: any) => `${node.id} (${node.val})`}
      width={800}
      height={600}
    />
  )
}