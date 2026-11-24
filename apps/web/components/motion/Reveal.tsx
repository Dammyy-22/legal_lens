'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

export const EASE = [0.2, 0.75, 0.25, 1] as const

type Props = {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  as?: 'div' | 'article' | 'section' | 'li' | 'ul'
}

/** Fades and lifts content into view once. Static when reduced motion is requested. */
export function Reveal({ children, className, delay = 0, y = 18, as = 'div' }: Props) {
  const reduce = useReducedMotion()
  const Tag = motion[as]
  if (reduce) {
    return <Tag className={className}>{children}</Tag>
  }
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </Tag>
  )
}

/** Staggers children that are wrapped in <StaggerItem>. */
export function Stagger({
  children,
  className,
  step = 0.07,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  step?: number
  as?: 'div' | 'ul' | 'section'
}) {
  const reduce = useReducedMotion()
  const Tag = motion[as]
  if (reduce) return <Tag className={className}>{children}</Tag>
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: step } } }}
    >
      {children}
    </Tag>
  )
}

export function StaggerItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'li' | 'article'
}) {
  const reduce = useReducedMotion()
  const Tag = motion[as]
  if (reduce) return <Tag className={className}>{children}</Tag>
  return (
    <Tag
      className={className}
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
      }}
    >
      {children}
    </Tag>
  )
}
