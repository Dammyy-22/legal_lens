'use client'

import { useEffect, useState } from 'react'
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
  BriefcaseBusiness,
  BookOpenText,
  FilePenLine,
  Settings,
  Menu,
  X,
  LogOut,
  UserCircle,
  ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BrandLogo } from '@/components/BrandLogo'
import { PageTransition } from '@/components/motion/PageTransition'
import { motion } from 'motion/react'
import {
  isSessionInactive,
  SESSION_INACTIVITY_TIMEOUT_MS,
  sessionActivityStorageKey,
  sessionIdFromAccessToken,
} from '@/lib/session-idle'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', Icon: LayoutDashboard },
  { href: '/dashboard/ask', label: 'Ask a question', Icon: MessageCircleQuestion },
  { href: '/dashboard/search', label: 'Search the law', Icon: Search },
  { href: '/dashboard/constitution', label: 'Constitution', Icon: Landmark },
  { href: '/dashboard/rights', label: 'Rights explorer', Icon: Scale },
  { href: '/dashboard/lawyers', label: 'Find a lawyer', Icon: UserSearch },
  { href: '/dashboard/documents', label: 'My documents', Icon: FileText },
  { href: '/dashboard/matters', label: 'Matters & tasks', Icon: BriefcaseBusiness },
  { href: '/dashboard/cases', label: 'Case-law research', Icon: BookOpenText },
  { href: '/dashboard/drafting', label: 'Prepare correspondence', Icon: FilePenLine },
]

export interface DashboardUser {
  fullName: string | null
  email: string | null
  isAdmin?: boolean
}

export function DashboardShell({
  user,
  children,
}: {
  user: DashboardUser
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  useEffect(() => {
    const supabase = createClient()
    let activityKey: string | null = null
    let lastActivity = 0
    let lastStoredActivity = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let endingSession = false
    let disposed = false

    async function clearUnvalidatedSession() {
      try {
        const { error } = await supabase.auth.signOut({ scope: 'local' })
        if (error) throw error
      } catch (error) {
        console.error('Could not clear an unvalidated browser session:', error)
      }
    }

    async function endIdleSession() {
      if (endingSession || disposed) return
      endingSession = true
      try {
        const { error } = await supabase.auth.signOut({ scope: 'local' })
        if (error) throw error
        if (activityKey) localStorage.removeItem(activityKey)
        router.replace('/auth/login?reason=idle_timeout')
        router.refresh()
      } catch (error) {
        console.error('Could not end an inactive session:', error)
        setLogoutError('Your session expired, but sign-out could not complete. Please reload and sign in again.')
        endingSession = false
        timer = setTimeout(() => void endIdleSession(), 10_000)
      }
    }

    function scheduleExpiry() {
      if (!activityKey || disposed || endingSession) return
      if (timer) clearTimeout(timer)
      const remaining = lastActivity + SESSION_INACTIVITY_TIMEOUT_MS - Date.now()
      if (remaining <= 0) {
        void endIdleSession()
        return
      }
      timer = setTimeout(() => void endIdleSession(), remaining)
    }

    function handleActivity(event: Event) {
      if (!activityKey || disposed || endingSession) return
      const now = Date.now()
      if (isSessionInactive(String(lastActivity), now)) {
        void endIdleSession()
        return
      }
      lastActivity = now
      if (event.type !== 'mousemove' || now - lastStoredActivity >= 10_000) {
        localStorage.setItem(activityKey, String(now))
        lastStoredActivity = now
      }
      scheduleExpiry()
    }

    function handleStorage(event: StorageEvent) {
      if (!activityKey || event.key !== activityKey) return
      if (event.newValue === null || isSessionInactive(event.newValue)) {
        void endIdleSession()
        return
      }
      lastActivity = Number(event.newValue)
      scheduleExpiry()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') scheduleExpiry()
    }

    async function initializeIdleTimeout() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()
        if (error) throw error
        if (!session) {
          await clearUnvalidatedSession()
          router.replace('/auth/login?reason=session_expired')
          router.refresh()
          return
        }

        const sessionId = sessionIdFromAccessToken(session.access_token)
        activityKey = sessionActivityStorageKey(sessionId)
        const storedActivity = localStorage.getItem(activityKey)
        if (isSessionInactive(storedActivity)) {
          void endIdleSession()
          return
        }

        lastActivity = storedActivity === null ? Date.now() : Number(storedActivity)
        lastStoredActivity = lastActivity
        if (storedActivity === null) localStorage.setItem(activityKey, String(lastActivity))
        scheduleExpiry()
      } catch (error) {
        console.error('Could not initialize session inactivity timeout:', error)
        await clearUnvalidatedSession()
        router.replace('/auth/login?reason=session_expired')
        router.refresh()
      }
    }

    const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'mousemove']
    activityEvents.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }))
    window.addEventListener('storage', handleStorage)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    void initializeIdleTimeout()

    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, handleActivity))
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [router])

  // Per product decision: never show the user's raw email in the dashboard chrome —
  // show their name (or a neutral fallback) with an avatar icon instead. Email is
  // still used internally (Supabase auth, Settings page) — just not displayed here.
  const displayName = user.fullName?.trim() || 'Account'

  async function handleLogout() {
    setLoggingOut(true)
    setLogoutError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      router.push('/')
      router.refresh()
    } catch {
      setLogoutError('Unable to sign out. Please try again.')
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F7F7F4]">
      {/* Top navigation trigger across all viewports */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#F7F7F4]/95 px-4 py-3 backdrop-blur sm:px-6">
        <BrandLogo href="/dashboard" compact />
        <button
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-100 bg-white/80 text-ink transition-colors hover:bg-white"
        >
          <Menu size={18} />
        </button>
      </header>

      {open && (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-[2px]"
        />
      )}

      {/* Overlay sidebar drawer — opens on click, non-scrolling full item list */}
      <aside
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-ink-100 bg-white shadow-2xl transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <BrandLogo href="/dashboard" compact />
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-paper hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <nav aria-label="Workspace" className="flex-1 space-y-0.5 px-3 py-3">
          <p className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">Workspace</p>
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'text-white'
                    : 'text-ink-400 hover:bg-paper hover:text-ink'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active-pill"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-lg bg-ink shadow-sm"
                    transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  />
                )}
                <Icon size={17} strokeWidth={1.8} className={`relative shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${active ? 'text-brass-400' : ''}`} />
                <span className="relative">{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-ink-100 px-3 py-3">
          {user.isAdmin && (
            <Link
              href="/dashboard/admin"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                pathname === '/dashboard/admin'
                  ? 'bg-ink text-paper'
                  : 'text-brass-600 hover:bg-paper'
              }`}
            >
              <ShieldCheck size={17} strokeWidth={1.75} className="shrink-0" />
              Admin
            </Link>
          )}
          <Link
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              pathname === '/dashboard/settings'
                ? 'bg-ink text-paper'
                : 'text-ink-400 hover:bg-paper hover:text-ink'
            }`}
          >
            <Settings size={17} strokeWidth={1.75} className="shrink-0" />
            Settings
          </Link>

          <div className="mt-1 flex items-center justify-between rounded-lg bg-paper/70 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <UserCircle size={26} strokeWidth={1.5} className="shrink-0 text-ink-400" />
              <span className="truncate text-sm font-medium text-ink">{displayName}</span>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              disabled={loggingOut}
              className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-white hover:text-seal disabled:opacity-50"
            >
              <LogOut size={16} strokeWidth={1.75} />
            </button>
          </div>
          {logoutError && (
            <p role="alert" className="px-3 pt-2 text-xs text-seal">
              {logoutError}
            </p>
          )}
        </div>
      </aside>

      <main id="main-content" className="min-w-0 flex-1"><PageTransition>{children}</PageTransition></main>
    </div>
  )
}
