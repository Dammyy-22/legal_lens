'use client'

import { motion, useReducedMotion } from 'motion/react'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/** Gentle entrance when the dashboard route changes. Opacity + small translate only. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.2, 0.75, 0.25, 1] }}
    >
      {children}
    </motion.div>
  )
}
