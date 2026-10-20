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
import { QuickNavigation } from '@/components/QuickNavigation'
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
    setOpen(false)
  }, [pathname])

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
    <div className="min-h-screen bg-[#F7F7F4] md:flex">
      {/* Mobile top bar with hamburger */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-100 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <BrandLogo href="/dashboard" compact />
        <button
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-100 text-ink transition-colors hover:bg-paper"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Sidebar — persistent on desktop (md+), slide-down panel on mobile when open */}
      <aside
        className={`${
          open ? 'flex' : 'hidden'
        } md:flex md:w-[17rem] w-full shrink-0 flex-col border-b border-ink-100 bg-white md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r`}
      >
        <div className="hidden border-b border-ink-100 px-6 py-6 md:block">
          <BrandLogo href="/dashboard" compact />
        </div>

        <nav aria-label="Workspace" className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">Workspace</p>
          <QuickNavigation isAdmin={user.isAdmin} />
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-ink text-white shadow-sm'
                    : 'text-ink-400 hover:bg-paper hover:text-ink'
                }`}
              >
                <Icon size={18} strokeWidth={1.8} className={`shrink-0 ${active ? 'text-brass-400' : ''}`} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-ink-100 px-3 py-4">
          {user.isAdmin && (
            <Link
              href="/dashboard/admin"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/dashboard/admin'
                  ? 'bg-ink text-paper'
                  : 'text-brass-600 hover:bg-paper'
              }`}
            >
              <ShieldCheck size={18} strokeWidth={1.75} className="shrink-0" />
              Admin
            </Link>
          )}
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

          <div className="flex items-center justify-between px-3 py-3 mt-1 rounded-lg bg-paper/70">
            <div className="flex items-center gap-2 min-w-0">
              <UserCircle size={28} strokeWidth={1.5} className="text-ink-400 shrink-0" />
              <span className="text-sm text-ink font-medium truncate">{displayName}</span>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              disabled={loggingOut}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-white hover:text-seal disabled:opacity-50 shrink-0 ml-2"
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

      <main id="main-content" className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
