// Deterministic knowledge-graph layout shared by the 3D scene and the static SVG fallback.
// Nodes stand for statutes, cases and documents; edges link nearby nodes.

export type GraphNode = { x: number; y: number; z: number; kind: 0 | 1 | 2 }

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

export function buildGraph(count = 30) {
  const rand = mulberry32(2026)
  const nodes: GraphNode[] = []
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1
    const a = rand() * Math.PI * 2
    const r = 1.2 + rand() * 0.9
    const s = Math.sqrt(1 - u * u)
    nodes.push({
      x: round4(r * s * Math.cos(a) * 1.35),
      y: round4(r * u),
      z: round4(r * s * Math.sin(a)),
      kind: (i % 3) as 0 | 1 | 2,
    })
  }
  const edges: [number, number][] = []
  nodes.forEach((n, i) => {
    nodes
      .map((m, j) => ({ j, d: (n.x - m.x) ** 2 + (n.y - m.y) ** 2 + (n.z - m.z) ** 2 }))
      .filter((o) => o.j > i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2)
      .forEach((o) => edges.push([i, o.j]))
  })
  return { nodes, edges }
}
