'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, BookOpenText, ExternalLink, Search } from 'lucide-react'

const NIGERIALII_SEARCH = 'https://nigerialii.org/search/'
const NIGERIALII_JUDGMENTS = 'https://nigerialii.org/judgments/'

export default function CasesPage() {
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmittedQuery(query.trim())
  }

  const searchUrl = submittedQuery
    ? `${NIGERIALII_SEARCH}?q=${encodeURIComponent(submittedQuery)}`
    : ''

  return (
    <div className="workspace-enter mx-auto max-w-5xl px-5 py-8 sm:px-8 md:py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass-600">Case-law research</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-ink">Find Nigerian judgments</h1>
      <p className="mb-7 mt-3 max-w-3xl leading-7 text-ink-400">
        Search an external public legal-information index for judgment text. LegalLens does
        not yet maintain a verified case-law corpus, so external judgments are not used in
        LegalLens AI answers or presented as reviewed authorities.
      </p>

      <form onSubmit={handleSearch} className="mb-6 rounded-xl border border-ink-100 bg-white p-4 sm:p-5">
        <label htmlFor="case-search" className="mb-2 block text-sm font-medium text-ink">Search by case name, citation, court, or topic</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              id="case-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={200}
              placeholder="e.g. Supreme Court contract interpretation"
              className="min-h-12 w-full rounded-lg border border-ink-100 py-3 pl-10 pr-3 text-sm text-ink placeholder:text-ink-400 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
            />
          </div>
          <button
            type="submit"
            disabled={query.trim().length < 2}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Search size={16} /> Find judgments
          </button>
        </div>
      </form>

      {searchUrl && (
        <section aria-live="polite" className="mb-7 rounded-xl border border-brass/25 bg-white p-5">
          <p className="text-sm leading-6 text-ink-400">
            Your search is ready. Results open on NigeriaLII, an external legal-information
            service; LegalLens does not copy or independently verify its judgment records.
          </p>
          <a
            href={searchUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-600"
          >
            Search NigeriaLII for “{submittedQuery}” <ExternalLink size={15} />
          </a>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <a
          href={NIGERIALII_JUDGMENTS}
          target="_blank"
          rel="noreferrer"
          className="group rounded-xl border border-ink-100 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brass/40 hover:shadow-[0_10px_24px_rgba(20,38,30,0.07)]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-paper text-brass-600">
            <BookOpenText size={20} />
          </span>
          <h2 className="mt-4 flex items-center gap-2 font-display text-xl font-medium text-ink">
            Browse judgments by court <ArrowUpRight size={16} className="text-brass-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-400">
            Open NigeriaLII’s court and tribunal judgment index.
          </p>
        </a>

        <div className="rounded-xl border border-ink-100 bg-paper/60 p-5">
          <h2 className="font-display text-xl font-medium text-ink">Verify before relying on a case</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-ink-400">
            <li>Check the court, date, case number, and the full judgment.</li>
            <li>Confirm whether a later decision or appeal affected the result.</li>
            <li>Consult a qualified lawyer about how a case applies to your facts.</li>
          </ul>
          <Link href="/dashboard/lawyers" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brass-600 hover:text-ink">
            Find professional support <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>

      <p className="mt-7 text-xs leading-5 text-ink-400">
        NigeriaLII states that it publishes Nigerian law for free access. This link is an
        external research starting point, not a guarantee that its collection is complete
        or current. LegalLens has not independently reviewed individual external records.
      </p>
    </div>
  )
}
