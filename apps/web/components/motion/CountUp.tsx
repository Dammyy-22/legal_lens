'use client'

import { animate, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

/** Counts up to `value` once when scrolled into view. Shows the final value immediately when reduced motion is on. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    if (reduce || !inView) return
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.2, 0.75, 0.25, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return () => controls.stop()
  }, [inView, reduce, value])

  return (
    <span ref={ref} className={className} aria-label={String(value)}>
      <span aria-hidden="true">{reduce ? value : display}</span>
    </span>
  )
}
