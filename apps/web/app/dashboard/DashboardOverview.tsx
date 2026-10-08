'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  FileText,
  Landmark,
  MessageSquareText,
  Search,
  Scale,
  UserRoundSearch,
  type LucideIcon,
} from 'lucide-react'

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
    description: 'Find passages in the available verified legal sources.',
    category: 'Research',
  },
  {
    href: '/dashboard/constitution',
    Icon: Landmark,
    title: 'Read the Constitution',
    description: 'Browse its chapters, sections, and substantive text.',
    category: 'Primary source',
  },
  {
    href: '/dashboard/rights',
    Icon: Scale,
    title: 'Explore common situations',
    description: 'Practical first steps and links to relevant official services.',
    category: 'Guides',
  },
  {
    href: '/dashboard/lawyers',
    Icon: UserRoundSearch,
    title: 'Find a lawyer',
    description: 'Use the NBA directory and its licence verification service.',
    category: 'Support',
  },
  {
    href: '/dashboard/documents',
    Icon: FileText,
    title: 'Review a document',
    description: 'Upload a private file and ask questions about its text.',
    category: 'Your workspace',
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
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 md:py-12">
      <header className="mb-9">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-brass-600">
          Your legal workspace
        </p>
        <h1 className="font-display text-4xl font-medium leading-tight tracking-[-0.04em] text-ink sm:text-5xl">
          {firstName ? `Welcome, ${firstName}` : 'Welcome'}
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-ink-400">
          Explore Nigerian legal sources, get oriented on a question, and keep
          the source trail close as you decide what to do next.
        </p>
      </header>

      <section aria-label="Legal research" className="image-card group relative mb-8 h-44 overflow-hidden rounded-2xl border border-ink-100 bg-ink shadow-sm sm:h-52">
        <Image
          src="https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=2400&q=90"
          alt="Law books in a legal library"
          fill
          priority
          quality={90}
          sizes="(max-width: 768px) 100vw, 1100px"
          className="motion-image object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/50 to-transparent" />
        <div className="absolute inset-y-0 left-6 flex max-w-lg flex-col justify-center sm:left-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass-400">Research with context</p>
          <p className="mt-2 font-display text-2xl font-medium leading-tight text-white sm:text-3xl">Keep the law and its sources in view.</p>
        </div>
      </section>

      <section className="relative mb-10 overflow-hidden rounded-2xl bg-ink text-paper shadow-[0_16px_44px_rgba(20,38,30,0.13)]">
        <div className="absolute -right-24 -top-36 h-80 w-80 rounded-full border border-brass/20" />
        <div className="absolute -right-8 -top-20 h-60 w-60 rounded-full border border-brass/15" />
        <div className="relative max-w-3xl px-6 py-8 sm:px-9 sm:py-10">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-brass-400">
            Start with a question
          </p>
          <h2 className="max-w-2xl font-display text-3xl font-medium leading-tight tracking-[-0.035em] sm:text-4xl">
            What would you like to understand?
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-paper/70 sm:text-base">
            Ask in plain language. Review the explanation alongside its
            citations and source material.
          </p>
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
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass-600">Need a starting point?</p>
          <h2 id="question-ideas-heading" className="mt-1 font-display text-xl font-medium text-ink">
            Questions you can explore
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
          <strong className="font-semibold text-ink">A note on legal information:</strong>{' '}
          LegalLens is not a law firm and does not provide legal advice.
        </p>
        <Link href="/dashboard/lawyers" className="inline-flex shrink-0 items-center gap-1 font-medium text-brass-600 hover:text-ink">
          Find legal support <ArrowRight size={15} />
        </Link>
      </aside>
    </div>
  )
}
