'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { buildGraph } from './graph-data'

// Brand colours only: ink green, brass, ink-400.
const KIND_COLORS = ['#B08D3E', '#1F4D3D', '#3C5A4C']

function Graph({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const { nodes, edges } = useMemo(() => buildGraph(), [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  const lineGeo = useMemo(() => {
    const pts: number[] = []
    edges.forEach(([a, b]) => {
      pts.push(nodes[a].x, nodes[a].y, nodes[a].z, nodes[b].x, nodes[b].y, nodes[b].z)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [nodes, edges])

  const pointGeos = useMemo(
    () =>
      [0, 1, 2].map((k) => {
        const g = new THREE.BufferGeometry()
        const p = nodes.filter((n) => n.kind === k).flatMap((n) => [n.x, n.y, n.z])
        g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
        return g
      }),
    [nodes],
  )

  useFrame((_, dt) => {
    const g = group.current
    if (!g || !active) return
    g.rotation.y += dt * 0.07
    g.rotation.x += (pointer.current.y * 0.25 - g.rotation.x) * Math.min(1, dt * 2)
    g.position.x += (pointer.current.x * 0.25 - g.position.x) * Math.min(1, dt * 2)
  })

  return (
    <group ref={group}>
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial color="#3C5A4C" transparent opacity={0.35} />
      </lineSegments>
      {pointGeos.map((geo, i) => (
        <points key={i} geometry={geo}>
          <pointsMaterial color={KIND_COLORS[i]} size={0.14} sizeAttenuation transparent opacity={0.95} />
        </points>
      ))}
    </group>
  )
}

export default function KnowledgeGraphScene({ active }: { active: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 6], fov: 45 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      frameloop={active ? 'always' : 'never'}
      style={{ pointerEvents: 'none' }}
    >
      <Graph active={active} />
    </Canvas>
  )
}
