'use client'

import { FormEvent, useState } from 'react'
import { Search } from 'lucide-react'
import { searchLegalSources, type LegalSearchResult } from '@/lib/api-client'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LegalSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuery = query.trim()
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
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 md:py-14">
      <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-2">Legal search</p>
      <h1 className="font-display text-4xl text-ink mb-3">Search the law</h1>
      <p className="text-ink-400 leading-relaxed mb-8 max-w-2xl">
        Search verified Nigerian legal sources. Every result keeps its source and section provenance.
      </p>

      <form onSubmit={handleSearch} className="flex gap-3 mb-10">
        <label className="relative flex-1">
          <span className="sr-only">Search legal sources</span>
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-100" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try fundamental rights or tenancy"
            className="w-full pl-11 pr-4 py-3 border border-ink-100 rounded-lg bg-white text-ink placeholder:text-ink-400 focus:border-brass focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={loading || query.trim().length < 2}
          className="px-5 py-3 rounded-lg bg-ink text-paper font-medium disabled:opacity-40"
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
          <article key={result.chunk_id} className="p-6 bg-white border border-ink-100 rounded-lg">
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
