'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { buildGraph } from './graph-data'

const Scene = dynamic(() => import('./KnowledgeGraphScene'), { ssr: false })

const COLORS = ['#B08D3E', '#1F4D3D', '#3C5A4C']

function StaticGraph() {
  const { nodes, edges } = buildGraph()
  const px = (n: { x: number; z: number }) => (50 + (n.x + n.z * 0.3) * 17).toFixed(3)
  const py = (n: { y: number }) => (50 + n.y * 17).toFixed(3)
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={px(nodes[a])}
          y1={py(nodes[a])}
          x2={px(nodes[b])}
          y2={py(nodes[b])}
          stroke="#3C5A4C"
          strokeOpacity="0.3"
          strokeWidth="0.2"
        />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={px(n)} cy={py(n)} r="0.8" fill={COLORS[n.kind]} />
      ))}
    </svg>
  )
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * Decorative background: a connected-knowledge graph (statutes, cases, documents).
 * 3D only on capable, wide, motion-friendly devices; otherwise a static SVG.
 * Paused when offscreen or the tab is hidden. Never intercepts input.
 */
export function KnowledgeGraph({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const host = useRef<HTMLDivElement>(null)
  const [enable3d, setEnable3d] = useState(false)
  const [visible, setVisible] = useState(true)
  const [tabVisible, setTabVisible] = useState(true)

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)').matches
    const cores = navigator.hardwareConcurrency ?? 4
    setEnable3d(!reduce && wide && cores >= 4 && hasWebGL())
  }, [reduce])

  useEffect(() => {
    const el = host.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting))
    io.observe(el)
    const onVis = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <div ref={host} aria-hidden="true" className={`pointer-events-none select-none ${className}`}>
      {enable3d ? <Scene active={visible && tabVisible} /> : <StaticGraph />}
    </div>
  )
}
