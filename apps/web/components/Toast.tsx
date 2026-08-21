'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onClose?.()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!isVisible) return null

  const bgColor =
    type === 'success'
      ? 'bg-green-50 border-green-200'
      : type === 'error'
        ? 'bg-red-50 border-red-200'
        : 'bg-blue-50 border-blue-200'

  const textColor =
    type === 'success' ? 'text-green-800' : type === 'error' ? 'text-red-800' : 'text-blue-800'

  const icon =
    type === 'success' ? (
      <CheckCircleIcon className="w-5 h-5 text-green-500" />
    ) : type === 'error' ? (
      <XCircleIcon className="w-5 h-5 text-red-500" />
    ) : null

  return (
    <div
      className={`fixed top-4 right-4 max-w-md p-4 border rounded-lg shadow-lg flex items-center gap-3 animate-fadeIn ${bgColor}`}
    >
      {icon}
      <span className={`text-sm font-medium ${textColor}`}>{message}</span>
    </div>
  )
}
