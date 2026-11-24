import React, { ReactNode } from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClass =
    'font-medium rounded-lg transition-all duration-200 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed'

  const variantClass = {
    primary: 'bg-ink text-white shadow-sm hover:bg-ink-600 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(20,38,30,0.14)]',
    secondary: 'bg-paper text-ink hover:bg-paper-200',
    outline: 'border border-ink-100 bg-white text-ink hover:border-brass/50 hover:bg-paper',
  }

  const sizeClass = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  }

  return (
    <button
      className={`${baseClass} ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      <span className="flex items-center justify-center gap-2">
        {loading && (
          <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {children}
      </span>
    </button>
  )
}
