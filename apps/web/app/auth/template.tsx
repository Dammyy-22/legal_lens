'use client'

import { motion, useReducedMotion } from 'motion/react'

// Re-mounts on each auth navigation, giving a soft entrance between sign-in, register and reset.
export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.75, 0.25, 1] }}
    >
      {children}
    </motion.div>
  )
}
