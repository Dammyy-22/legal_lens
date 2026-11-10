'use client'

import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  AlertTriangle,
  BriefcaseBusiness,
  Gavel,
  FilePenLine,
  BookOpenText,
  FileText,
  Landmark,
  MessageSquareText,
  Search,
  Scale,
  UserRoundSearch,
  type LucideIcon,
} from 'lucide-react'
import { LegalFactOfTheDay } from '@/components/LegalFactOfTheDay'

const TOOLS: {
  href: string
  Icon: LucideIcon
  title: string
  description: string
  category: string
}[] = [
  {
    href: '/dashboard/search',
    Icon: Search,
    title: 'Search the law',
    description: 'Search verified legal sources.',
    category: 'Research',
  },
  {
    href: '/dashboard/constitution',
    Icon: Landmark,
    title: 'Read the Constitution',
    description: 'Browse chapters and sections.',
    category: 'Primary source',
  },
  {
    href: '/dashboard/rights',
    Icon: Scale,
    title: 'Explore common situations',
    description: 'View practical steps and official links.',
    category: 'Guides',
  },
  {
    href: '/dashboard/lawyers',
    Icon: UserRoundSearch,
    title: 'Find a lawyer',
    description: 'Search the NBA directory and verify a licence.',
    category: 'Support',
  },
  {
    href: '/dashboard/documents',
    Icon: FileText,
    title: 'Review a document',
    description: 'Ask questions about a private document.',
    category: 'Your workspace',
  },
  {
    href: '/dashboard/matters',
    Icon: BriefcaseBusiness,
    title: 'Organize a matter',
    description: 'Track tasks and dates.',
    category: 'Your workspace',
  },
  {
    href: '/dashboard/cases',
    Icon: Gavel,
    title: 'Research judgments',
    description: 'Search external judgments; verify records independently.',
    category: 'External research',
  },
  {
    href: '/dashboard/drafting',
    Icon: FilePenLine,
    title: 'Draft a message',
    description: 'Create a preliminary message from your facts.',
    category: 'Writing',
  },
]

const STARTING_QUESTIONS = [
  'What does the Constitution say about fair hearing?',
  'What should I check before responding to a legal notice?',
  'Which records should I keep for an employment dispute?',
]

export default function DashboardOverview({ fullName }: { fullName: string | null }) {
  const firstName = fullName?.trim().split(/\s+/)[0] || null

  return (
    <div className="workspace-enter mx-auto max-w-6xl px-5 py-8 sm:px-8 md:py-12">
      <header className="mb-9">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-brass-600">
          Your legal workspace
        </p>
        <h1 className="font-display text-4xl font-medium leading-tight tracking-[-0.04em] text-ink sm:text-5xl">
          {firstName ? `Welcome, ${firstName}` : 'Welcome'}
        </h1>
      </header>

      <div className="mb-10">
        <LegalFactOfTheDay />
      </div>

      <aside className="mb-5 flex flex-col gap-3 rounded-xl border border-seal/20 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-seal/5 text-seal">
            <AlertTriangle size={18} />
          </span>
          <p className="text-sm leading-6 text-ink-400">
            <strong className="font-semibold text-ink">Urgent situation?</strong>{' '}
            In immediate danger? Contact local emergency support. For arrest or detention guidance, use the Rights guides.
          </p>
        </div>
        <Link
          href="/dashboard/rights"
          className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-lg border border-seal/20 px-3 py-2 text-sm font-medium text-seal transition-colors hover:bg-seal/5 sm:self-auto"
        >
          Rights guides <ArrowRight size={15} />
        </Link>
      </aside>

      <section className="relative mb-10 overflow-hidden rounded-2xl bg-ink text-paper shadow-[0_16px_44px_rgba(20,38,30,0.13)]">
        <div className="absolute -right-24 -top-36 h-80 w-80 rounded-full border border-brass/20" />
        <div className="absolute -right-8 -top-20 h-60 w-60 rounded-full border border-brass/15" />
        <div className="relative max-w-3xl px-6 py-8 sm:px-9 sm:py-10">
          <h2 className="max-w-2xl font-display text-3xl font-medium leading-tight tracking-[-0.035em] sm:text-4xl">
            Have a legal question?
          </h2>
          <Link
            href="/dashboard/ask"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brass px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-brass-400"
          >
            <MessageSquareText size={17} /> Ask a legal question <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section aria-labelledby="tools-heading" className="mb-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass-600">Explore</p>
            <h2 id="tools-heading" className="mt-1 font-display text-2xl font-medium tracking-tight text-ink">
              Your tools
            </h2>
          </div>
          <BookOpenText size={21} className="mb-1 text-brass-600" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TOOLS.map(({ href, Icon, title, description, category }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-40 flex-col rounded-xl border border-ink-100 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brass/50 hover:shadow-[0_12px_28px_rgba(20,38,30,0.08)]"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-paper text-brass-600 transition-colors group-hover:bg-ink group-hover:text-brass-400">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-400">{category}</span>
              </div>
              <span className="mt-4 flex items-center justify-between gap-3 font-display text-lg font-medium tracking-tight text-ink">
                {title}
                <ArrowUpRight size={16} className="shrink-0 text-ink-100 transition-colors group-hover:text-brass-600" />
              </span>
              <span className="mt-1 text-sm leading-6 text-ink-400">{description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="question-ideas-heading" className="mb-10 rounded-xl border border-ink-100 bg-white p-5 sm:p-7">
        <div className="mb-4">
          <h2 id="question-ideas-heading" className="mt-1 font-display text-xl font-medium text-ink">
            Start with a question
          </h2>
        </div>
        <ul className="grid gap-2 md:grid-cols-3">
          {STARTING_QUESTIONS.map((question) => (
            <li key={question}>
              <Link
                href={`/dashboard/ask?prompt=${encodeURIComponent(question)}`}
                className="flex h-full items-center justify-between gap-3 rounded-lg border border-ink-100 bg-paper/50 p-3.5 text-sm leading-5 text-ink-400 transition-colors hover:border-brass/40 hover:bg-paper hover:text-ink"
              >
                {question}
                <ArrowRight size={15} className="shrink-0 text-brass-600" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <aside className="flex flex-col gap-3 rounded-xl border border-brass/25 bg-white p-4 text-sm leading-6 text-ink-400 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p>
          Legal information, not legal advice.
        </p>
        <Link href="/dashboard/lawyers" className="inline-flex shrink-0 items-center gap-1 font-medium text-brass-600 hover:text-ink">
          Find legal support <ArrowRight size={15} />
        </Link>
      </aside>
    </div>
  )
}
