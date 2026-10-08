'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { searchLegalSources, type LegalSearchResult } from '@/lib/api-client'

export default function SearchPage() {
  const searchParams = useSearchParams()
  const linkedQuery = searchParams.get('q')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LegalSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const runSearch = useCallback(async (value: string) => {
    const trimmedQuery = value.trim()
    if (trimmedQuery.length < 2) return

    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      setResults(await searchLegalSources(trimmedQuery))
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
    void runSearch(linkedQuery)
  }, [linkedQuery, runSearch])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void runSearch(query)
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 md:py-14">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass-600">Research</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-ink">Search legal sources</h1>
      <p className="mb-8 mt-3 max-w-2xl leading-7 text-ink-400">
        Search available Nigerian legal text. Each result identifies its source
        and section so you can check the original context.
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

      {error && <p role="alert" className="mb-6 p-4 rounded-lg border border-seal/25 bg-seal/5 text-seal">{error}</p>}
      {searched && !loading && !error && results.length === 0 && (
        <p className="text-ink-400">No verified source passages matched that search.</p>
      )}

      <div className="space-y-4">
        {results.map((result) => (
          <article key={result.chunk_id} className="rounded-xl border border-ink-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center gap-2 mb-3 text-xs font-mono uppercase tracking-wide text-brass-600">
              <span>{result.source_title}</span>
              <span className="text-ink-100">/</span>
              <span>{result.section_label}</span>
            </div>
            <p className="text-ink leading-relaxed whitespace-pre-line">{result.text}</p>
            <a href={result.source_url} target="_blank" rel="noreferrer" className="inline-block mt-4 text-sm text-brass-600 hover:text-ink underline underline-offset-2">
              Open source document
            </a>
          </article>
        ))}
      </div>
    </div>
  )
}
