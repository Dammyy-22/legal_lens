'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', mark: '⌂' },
  { href: '/dashboard/ask', label: 'Ask a question', mark: '§' },
  { href: '/dashboard/search', label: 'Search the law', mark: '¶' },
  { href: '/dashboard/constitution', label: 'Constitution', mark: '⚑' },
  { href: '/dashboard/rights', label: 'Rights explorer', mark: '⚖' },
  { href: '/dashboard/lawyers', label: 'Find a lawyer', mark: '⌘' },
  { href: '/dashboard/documents', label: 'My documents', mark: '⎘' },
]

export function DashboardShell({
  email,
  children,
}: {
  email: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-paper md:flex">
      {/* Mobile top bar with hamburger */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-ink-100 px-4 py-3 sticky top-0 z-30">
        <span className="font-display italic text-xl text-ink">
          LegalLens<span className="text-brass not-italic">.</span>
        </span>
        <button
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="w-9 h-9 flex items-center justify-center rounded border border-ink-100 text-ink"
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          )}
        </button>
      </div>

      {/* Sidebar — persistent on desktop (md+), slide-down panel on mobile when open */}
      <aside
        className={`${
          open ? 'flex' : 'hidden'
        } md:flex flex-col w-full md:w-64 shrink-0 bg-white border-b md:border-b-0 md:border-r border-ink-100 md:h-screen md:sticky md:top-0`}
      >
        <div className="hidden md:block px-6 py-6">
          <Link href="/dashboard" className="font-display italic text-xl text-ink">
            LegalLens<span className="text-brass not-italic">.</span>
          </Link>
        </div>

        <nav className="px-3 py-3 md:py-0 space-y-1 flex-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-ink text-paper'
                    : 'text-ink-400 hover:bg-paper hover:text-ink'
                }`}
              >
                <span className="font-display text-base w-4 text-center" aria-hidden="true">
                  {item.mark}
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-3 border-t border-ink-100">
          <Link
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === '/dashboard/settings'
                ? 'bg-ink text-paper'
                : 'text-ink-400 hover:bg-paper hover:text-ink'
            }`}
          >
            <span className="font-display text-base w-4 text-center" aria-hidden="true">
              ⚙
            </span>
            Settings
          </Link>
          <div className="flex items-center justify-between px-3 py-2 mt-1">
            <span className="text-xs text-ink-400 truncate">{email}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-seal hover:underline font-medium shrink-0 ml-2"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
