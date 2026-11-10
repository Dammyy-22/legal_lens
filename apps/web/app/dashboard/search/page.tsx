'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Filter, Search } from 'lucide-react'
import {
  searchLegalSources,
  type LegalSearchFilters,
  type LegalSearchResult,
} from '@/lib/api-client'

const DOCUMENT_TYPES = [
  { value: 'constitution', label: 'Constitution' },
  { value: 'legislation', label: 'Legislation' },
  { value: 'regulation', label: 'Regulation' },
  { value: 'case_law', label: 'Case law' },
  { value: 'agency_guidance', label: 'Agency guidance' },
  { value: 'secondary_commentary', label: 'Commentary' },
]

const AUTHORITY_LEVELS = [
  { value: 'primary', label: 'Primary authority' },
  { value: 'institutional', label: 'Institutional source' },
  { value: 'secondary', label: 'Secondary source' },
]

function sourceTypeLabel(value: string): string {
  return DOCUMENT_TYPES.find((type) => type.value === value)?.label ?? value
}

function authorityLabel(value: string): string {
  return AUTHORITY_LEVELS.find((authority) => authority.value === value)?.label ?? value
}

export default function SearchPage() {
  const searchParams = useSearchParams()
  const linkedQuery = searchParams.get('q')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LegalSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [filters, setFilters] = useState<LegalSearchFilters>({
    jurisdiction: 'Nigeria',
  })

  const runSearch = useCallback(async (value: string, activeFilters: LegalSearchFilters) => {
    const trimmedQuery = value.trim()
    if (trimmedQuery.length < 2) return

    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      setResults(await searchLegalSources(trimmedQuery, 20, activeFilters))
    } catch (searchError) {
      setResults([])
      setError(searchError instanceof Error ? searchError.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!linkedQuery || linkedQuery.trim().length < 2) return
    setQuery(linkedQuery)
    void runSearch(linkedQuery, filters)
  }, [linkedQuery, runSearch, filters])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void runSearch(query, filters)
  }

  function updateFilter(key: keyof LegalSearchFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value || undefined }))
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 md:py-14">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass-600">Research</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-ink">Search legal sources</h1>
      <p className="mb-8 mt-3 max-w-2xl leading-7 text-ink-400">
        Search verified Nigerian legal sources and open the original text.
      </p>

      <form onSubmit={handleSearch} className="mb-9 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search legal sources</span>
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-100" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try fundamental rights or tenancy"
            className="min-h-12 w-full rounded-lg border border-ink-100 bg-white py-3 pl-11 pr-4 text-ink placeholder:text-ink-400 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
          />
        </label>
        <button
          type="submit"
          disabled={loading || query.trim().length < 2}
          className="min-h-12 rounded-lg bg-ink px-5 py-3 font-medium text-white transition-colors hover:bg-ink-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Searching' : 'Search'}
        </button>
      </form>

      <section aria-label="Search filters" className="mb-7 rounded-xl border border-ink-100 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Filter size={17} className="text-brass-600" />
          <h2 className="font-display text-lg font-medium text-ink">Narrow your research</h2>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wide text-ink-400">Verified, current sources</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-ink-400">
            Jurisdiction
            <select
              value={filters.jurisdiction ?? ''}
              onChange={(event) => updateFilter('jurisdiction', event.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-ink-100 bg-paper/50 px-3 text-sm text-ink focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
            >
              <option value="">All jurisdictions</option>
              <option value="Nigeria">Nigeria</option>
            </select>
          </label>
          <label className="text-xs font-medium text-ink-400">
            Source type
            <select
              value={filters.documentType ?? ''}
              onChange={(event) => updateFilter('documentType', event.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-ink-100 bg-paper/50 px-3 text-sm text-ink focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
            >
              <option value="">All source types</option>
              {DOCUMENT_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-ink-400">
            Authority
            <select
              value={filters.authorityLevel ?? ''}
              onChange={(event) => updateFilter('authorityLevel', event.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-ink-100 bg-paper/50 px-3 text-sm text-ink focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
            >
              <option value="">All authority levels</option>
              {AUTHORITY_LEVELS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void runSearch(query, filters)}
            disabled={loading || query.trim().length < 2}
            className="min-h-10 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => {
              const clearedFilters: LegalSearchFilters = {}
              setFilters(clearedFilters)
              void runSearch(query, clearedFilters)
            }}
            disabled={loading || query.trim().length < 2}
            className="min-h-10 rounded-lg border border-ink-100 px-4 py-2 text-sm font-medium text-ink-400 transition-colors hover:border-brass/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear filters
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-ink-400">
          Filters cover only verified sources currently available.
        </p>
      </section>

      {error && <p role="alert" className="mb-6 p-4 rounded-lg border border-seal/25 bg-seal/5 text-seal">{error}</p>}
      {searched && !loading && !error && results.length === 0 && (
        <p className="text-ink-400">No verified passages found. Try different terms or filters.</p>
      )}

      {searched && !loading && !error && results.length > 0 && (
        <p className="mb-4 text-sm text-ink-400" role="status">
          {results.length} verified {results.length === 1 ? 'passage' : 'passages'} found
        </p>
      )}

      <div className="space-y-4">
        {results.map((result) => (
          <article key={result.chunk_id} className="rounded-xl border border-ink-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center gap-2 mb-3 text-xs font-mono uppercase tracking-wide text-brass-600">
              <span>{result.source_title}</span>
              <span className="text-ink-100">/</span>
              <span>{result.section_label}</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wide text-ink-400">
              <span className="rounded-full bg-paper px-2.5 py-1">{result.jurisdiction}</span>
              <span className="rounded-full bg-paper px-2.5 py-1">{sourceTypeLabel(result.document_type)}</span>
              <span className="rounded-full bg-paper px-2.5 py-1">{authorityLabel(result.authority_level)}</span>
              <span className="rounded-full bg-ink/5 px-2.5 py-1">{result.status}</span>
            </div>
            <p className="text-ink leading-relaxed whitespace-pre-line">{result.text}</p>
            <a href={result.source_url} target="_blank" rel="noreferrer" className="inline-block mt-4 text-sm text-brass-600 hover:text-ink underline underline-offset-2">
              Optional: open source document
            </a>
          </article>
        ))}
      </div>
    </div>
  )
}
