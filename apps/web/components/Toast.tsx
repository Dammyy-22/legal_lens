'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
  onClose?: () => void
}

export function Toast({
  message,
  type,
  duration = 4000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)
  const reduce = useReducedMotion()

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onClose?.()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!isVisible) return null

  const tone =
    type === 'success'
      ? 'bg-white border-ink-400/30 text-ink'
      : type === 'error'
        ? 'bg-seal/5 border-seal/25 text-seal'
        : 'bg-white border-brass/30 text-ink'

  const icon =
    type === 'success' ? (
      <CheckCircleIcon className="w-5 h-5 text-ink-600" />
    ) : type === 'error' ? (
      <XCircleIcon className="w-5 h-5 text-seal" />
    ) : null

  return (
    <motion.div
      role={type === 'error' ? 'alert' : 'status'}
      initial={reduce ? false : { opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.2, 0.75, 0.25, 1] }}
      className={`fixed top-4 right-4 z-50 max-w-md p-4 border rounded-lg shadow-lg flex items-center gap-3 ${tone}`}
    >
      {icon}
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  )
}
