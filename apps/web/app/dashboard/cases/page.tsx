'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ExternalLink, Search } from 'lucide-react'
import { searchLegalSources, type LegalSearchResult } from '@/lib/api-client'

export default function CasesPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LegalSearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const term = query.trim()
    if (term.length < 2) return

    setLoading(true)
    setError('')
    setSearched(true)
    try {
      setResults(await searchLegalSources(term, 20, {
        jurisdiction: 'Nigeria',
        documentType: 'case_law',
      }))
    } catch (searchError) {
      setResults([])
      setError(searchError instanceof Error ? searchError.message : 'Unable to search case law.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="workspace-enter mx-auto max-w-5xl px-5 py-8 sm:px-8 md:py-12">
      <h1 className="font-display text-4xl font-medium tracking-tight text-ink">
        Search Nigerian judgments
      </h1>
      <p className="mb-7 mt-3 max-w-3xl leading-7 text-ink-400">
        Search verified case-law records in LegalLens. NigeriaLII live results are not connected.
      </p>

      <form onSubmit={handleSearch} className="mb-7 rounded-xl border border-ink-100 bg-white p-4 sm:p-5">
        <label htmlFor="case-search" className="mb-2 block text-sm font-medium text-ink">
          Case name, citation, court or topic
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              id="case-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={500}
              placeholder="e.g. Supreme Court contract interpretation"
              className="min-h-12 w-full rounded-lg border border-ink-100 py-3 pl-10 pr-3 text-sm text-ink placeholder:text-ink-400 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
            />
          </div>
          <button
            type="submit"
            disabled={loading || query.trim().length < 2}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Search size={16} /> {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="mb-6 rounded-lg border border-seal/25 bg-seal/5 p-4 text-sm text-seal">
          {error}
        </p>
      )}

      {searched && !loading && !error && results.length === 0 && (
        <section role="status" className="rounded-xl border border-ink-100 bg-white p-5">
          <h2 className="font-display text-lg font-medium text-ink">No verified judgments found</h2>
          <p className="mt-1 text-sm text-ink-400">
            Try another search. LegalLens only shows judgments added to its verified case-law collection.
          </p>
        </section>
      )}

      {results.length > 0 && (
        <section aria-label="Case-law search results">
          <p className="mb-4 text-sm text-ink-400" role="status">
            {results.length} {results.length === 1 ? 'judgment' : 'judgments'}
          </p>
          <div className="space-y-4">
            {results.map((result) => (
              <article key={result.chunk_id} className="rounded-xl border border-ink-100 bg-white p-5 sm:p-6">
                <div className="mb-3">
                  <h2 className="font-display text-xl font-medium text-ink">{result.source_title}</h2>
                  <p className="mt-1 text-xs text-ink-400">
                    {[result.jurisdiction, result.section_label, result.section_heading, result.status, result.effective_date]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <p className="whitespace-pre-line text-sm leading-6 text-ink">{result.text}</p>
                <a
                  href={result.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1 text-sm text-brass-600 underline underline-offset-2"
                >
                  Optional: open cited source <ExternalLink size={14} />
                </a>
              </article>
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-xs leading-5 text-ink-400">
        Check the full judgment, court and later appeal history before relying on a case.
        For advice on your situation, consult a qualified lawyer.
      </p>
      <Link href="/dashboard/lawyers" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brass-600 hover:text-ink">
        Find a lawyer <ArrowUpRight size={14} />
      </Link>
    </div>
  )
}
