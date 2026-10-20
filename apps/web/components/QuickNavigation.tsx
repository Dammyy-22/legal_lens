'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BriefcaseBusiness,
  BookOpenText,
  Command,
  FileText,
  FilePenLine,
  Landmark,
  MessageCircleQuestion,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  UserRoundSearch,
  X,
} from 'lucide-react'

const DESTINATIONS = [
  { href: '/dashboard', label: 'Workspace overview', Icon: Landmark },
  { href: '/dashboard/ask', label: 'Ask a legal question', Icon: MessageCircleQuestion },
  { href: '/dashboard/search', label: 'Search legal sources', Icon: Search },
  { href: '/dashboard/constitution', label: 'Read the Constitution', Icon: BookOpenText },
  { href: '/dashboard/rights', label: 'Explore rights and situations', Icon: Scale },
  { href: '/dashboard/lawyers', label: 'Find legal support', Icon: UserRoundSearch },
  { href: '/dashboard/documents', label: 'Review my documents', Icon: FileText },
  { href: '/dashboard/matters', label: 'Matters and tasks', Icon: BriefcaseBusiness },
  { href: '/dashboard/cases', label: 'Search case law', Icon: BookOpenText },
  { href: '/dashboard/drafting', label: 'Prepare correspondence', Icon: FilePenLine },
  { href: '/dashboard/settings', label: 'Account settings', Icon: Settings },
]

export function QuickNavigation({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const destinations = isAdmin
    ? [...DESTINATIONS, { href: '/dashboard/admin', label: 'Corpus review admin', Icon: ShieldCheck }]
    : DESTINATIONS
  const filteredDestinations = destinations.filter((destination) =>
    destination.label.toLowerCase().includes(query.trim().toLowerCase()),
  )

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      setOpen(true)
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
    if (open) inputRef.current?.focus()
  }, [open])

  function navigate(path: string) {
    router.push(path)
    setQuery('')
    setOpen(false)
  }

  function searchSources(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuery = query.trim()
    navigate(trimmedQuery ? `/dashboard/search?q=${encodeURIComponent(trimmedQuery)}` : '/dashboard/search')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-ink-100 bg-paper/60 px-3 text-left text-sm text-ink-400 transition-colors hover:border-brass/40 hover:bg-paper hover:text-ink"
        aria-haspopup="dialog"
      >
        <span className="inline-flex items-center gap-2">
          <Search size={16} />
          Quick navigation
        </span>
        <kbd className="rounded border border-ink-100 bg-white px-1.5 py-0.5 font-mono text-[10px]">Ctrl/Cmd K</kbd>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="quick-navigation-title"
        onClose={() => {
          setQuery('')
          setOpen(false)
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false)
        }}
        className="quick-navigation-dialog w-[min(34rem,calc(100%-2rem))] max-w-none rounded-2xl border border-ink-100 bg-white p-0 text-ink shadow-[0_24px_80px_rgba(20,38,30,0.24)]"
      >
        <div className="border-b border-ink-100 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass-600">Workspace</p>
              <h2 id="quick-navigation-title" className="mt-1 font-display text-xl font-medium">Where would you like to go?</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close quick navigation"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-paper hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>
          <form onSubmit={searchSources} role="search">
            <label htmlFor="quick-navigation-query" className="sr-only">Search tools or legal sources</label>
            <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-paper/60 px-3 focus-within:border-brass focus-within:ring-2 focus-within:ring-brass/20">
              <Search size={17} className="shrink-0 text-ink-400" />
              <input
                ref={inputRef}
                id="quick-navigation-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a tool or search a legal topic"
                className="min-h-12 min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-400 focus:outline-none"
              />
              <kbd className="hidden items-center gap-1 rounded border border-ink-100 bg-white px-1.5 py-0.5 font-mono text-[10px] text-ink-400 sm:inline-flex">
                <Command size={11} /> K
              </kbd>
            </div>
          </form>
        </div>

        <div className="max-h-[min(55vh,26rem)] overflow-y-auto p-2">
          {query.trim() && (
            <div className="mb-2 grid gap-1 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate(`/dashboard/search?q=${encodeURIComponent(query.trim())}`)}
                className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-paper/70 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-paper"
              >
                Search sources for “{query.trim()}” <ArrowRight size={15} className="shrink-0 text-brass-600" />
              </button>
              <button
                type="button"
                onClick={() => navigate(`/dashboard/ask?prompt=${encodeURIComponent(query.trim())}`)}
                className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-paper/70 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-paper"
              >
                Ask about “{query.trim()}” <ArrowRight size={15} className="shrink-0 text-brass-600" />
              </button>
            </div>
          )}
          <ul aria-label="Workspace destinations" className="space-y-1">
            {filteredDestinations.map(({ href, label, Icon }) => (
              <li key={href}>
                <button
                  type="button"
                  onClick={() => navigate(href)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink-400 transition-colors hover:bg-paper hover:text-ink"
                >
                  <Icon size={17} className="shrink-0 text-brass-600" />
                  {label}
                  <ArrowRight size={14} className="ml-auto text-ink-100" />
                </button>
              </li>
            ))}
            {filteredDestinations.length === 0 && (
              <li className="px-3 py-4 text-sm text-ink-400">No matching workspace tools.</li>
            )}
          </ul>
        </div>

        <div className="border-t border-ink-100 px-4 py-3 text-xs text-ink-400">
          Search results and AI answers should be checked against their cited sources.
        </div>
      </dialog>
    </>
  )
}
