'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  MessageCircleQuestion,
  Search,
  Landmark,
  Scale,
  UserSearch,
  FileText,
  Settings,
  Menu,
  X,
  LogOut,
  UserCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', Icon: LayoutDashboard },
  { href: '/dashboard/ask', label: 'Ask a question', Icon: MessageCircleQuestion },
  { href: '/dashboard/search', label: 'Search the law', Icon: Search },
  { href: '/dashboard/constitution', label: 'Constitution', Icon: Landmark },
  { href: '/dashboard/rights', label: 'Rights explorer', Icon: Scale },
  { href: '/dashboard/lawyers', label: 'Find a lawyer', Icon: UserSearch },
  { href: '/dashboard/documents', label: 'My documents', Icon: FileText },
]

export interface DashboardUser {
  fullName: string | null
  email: string | null
}

export function DashboardShell({
  user,
  children,
}: {
  user: DashboardUser
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Per product decision: never show the user's raw email in the dashboard chrome —
  // show their name (or a neutral fallback) with an avatar icon instead. Email is
  // still used internally (Supabase auth, Settings page) — just not displayed here.
  const displayName = user.fullName?.trim() || 'Account'

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
        <span className="font-display font-semibold text-xl text-ink">
          LegalLens<span className="text-brass">.</span>
        </span>
        <button
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="w-9 h-9 flex items-center justify-center rounded border border-ink-100 text-ink"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Sidebar — persistent on desktop (md+), slide-down panel on mobile when open */}
      <aside
        className={`${
          open ? 'flex' : 'hidden'
        } md:flex flex-col w-full md:w-64 shrink-0 bg-white border-b md:border-b-0 md:border-r border-ink-100 md:h-screen md:sticky md:top-0`}
      >
        <div className="hidden md:block px-6 py-6">
          <Link href="/dashboard" className="font-display font-semibold text-xl text-ink">
            LegalLens<span className="text-brass">.</span>
          </Link>
        </div>

        <nav className="px-3 py-3 md:py-0 space-y-1 flex-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-ink text-paper'
                    : 'text-ink-400 hover:bg-paper hover:text-ink'
                }`}
              >
                <Icon size={18} strokeWidth={1.75} className="shrink-0" />
                {label}
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
            <Settings size={18} strokeWidth={1.75} className="shrink-0" />
            Settings
          </Link>

          <div className="flex items-center justify-between px-3 py-2.5 mt-1 rounded-lg">
            <div className="flex items-center gap-2 min-w-0">
              <UserCircle size={28} strokeWidth={1.5} className="text-ink-100 shrink-0" />
              <span className="text-sm text-ink font-medium truncate">{displayName}</span>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              className="text-ink-400 hover:text-seal transition-colors shrink-0 ml-2"
            >
              <LogOut size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
