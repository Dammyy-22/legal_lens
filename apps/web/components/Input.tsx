import React, { InputHTMLAttributes, useState } from 'react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  icon?: React.ReactNode
}

export function Input({
  label,
  error,
  helperText,
  icon,
  type,
  className = '',
  id,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  const isPassword = type === 'password'
  const inputType = isPassword && showPassword ? 'text' : type

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-ink mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          type={inputType}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helperText ? `${inputId}-hint` : undefined}
          className={`
            w-full px-4 py-2.5 rounded-lg border bg-white transition-[border-color,box-shadow] duration-200
            placeholder:text-ink-400 text-ink
            focus:outline-none focus:ring-2
            ${icon ? 'pl-10' : ''}
            ${error
              ? 'border-seal/50 focus:border-seal focus:ring-seal/20'
              : 'border-ink-100 focus:border-brass focus:ring-brass/20'
            }
            ${className}
          `}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 transition-colors hover:text-ink"
          >
            {showPassword ? (
              <EyeSlashIcon className="w-5 h-5" />
            ) : (
              <EyeIcon className="w-5 h-5" />
            )}
          </button>
        )}
      </div>
      {error && (
        <p id={`${inputId}-hint`} role="alert" className="mt-1 text-sm text-seal font-medium input-hint-in">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${inputId}-hint`} className="mt-1 text-sm text-ink-400">
          {helperText}
        </p>
      )}
    </div>
  )
}
