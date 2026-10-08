'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'

const LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#about', label: 'About' },
]

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav aria-label="Main navigation" className="sticky top-0 z-50 border-b border-ink-100 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex h-16 items-center justify-between">
          <BrandLogo />

          <div className="hidden items-center gap-7 md:flex">
            {LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="text-sm font-medium text-ink-400 transition-colors hover:text-ink">
                {label}
              </Link>
            ))}
            <Link href="/auth/login" className="text-sm font-medium text-ink-400 transition-colors hover:text-ink">
              Sign in
            </Link>
            <Link href="/auth/register" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-600">
              Create account
            </Link>
          </div>

          <button
            type="button"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((current) => !current)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-100 text-ink transition-colors hover:bg-paper md:hidden"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {isOpen && (
          <div className="space-y-1 border-t border-ink-100 py-3 md:hidden">
            {LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-400 transition-colors hover:bg-paper hover:text-ink"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              onClick={() => setIsOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-400 transition-colors hover:bg-paper hover:text-ink"
            >
              Sign in
            </Link>
            <Link
              href="/auth/register"
              onClick={() => setIsOpen(false)}
              className="block rounded-lg bg-ink px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-600"
            >
              Create account
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
