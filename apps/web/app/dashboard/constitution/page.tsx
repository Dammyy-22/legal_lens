'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Landmark, Search } from 'lucide-react'
import { getConstitution, type LegalSearchResult } from '@/lib/api-client'

export default function ConstitutionPage() {
  const [passages, setPassages] = useState<LegalSearchResult[]>([])
  const [query, setQuery] = useState('')
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getConstitution()
      .then((results) => {
        setPassages(results)
        if (results[0]) setOpenChapters(new Set([results[0].section_label]))
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Constitution load failed'))
      .finally(() => setLoading(false))
  }, [])

  const normalizedQuery = query.trim().toLowerCase()
  const metadataMatches = normalizedQuery
    ? passages.filter((passage) =>
        `${passage.source_title} ${passage.section_label} ${passage.section_heading ?? ''}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : []
  const filteredPassages = normalizedQuery
    ? (metadataMatches.length > 0 ? metadataMatches : passages).filter((passage) =>
        `${passage.source_title} ${passage.section_label} ${passage.section_heading ?? ''} ${passage.text}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : passages

  const chapters = Array.from(
    filteredPassages.reduce((groups, passage) => {
      const key = passage.section_label || 'Unlabelled section'
      const group = groups.get(key) ?? []
      group.push(passage)
      groups.set(key, group)
      return groups
    }, new Map<string, LegalSearchResult[]>()),
  )

  function toggleChapter(label: string) {
    setOpenChapters((current) => {
      const next = new Set(current)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 md:py-14">
      <div className="w-12 h-12 rounded-lg bg-brass/10 flex items-center justify-center mb-4">
        <Landmark size={24} strokeWidth={1.5} className="text-brass-600" />
      </div>
      <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-2">
        Primary source
      </p>
      <h1 className="font-display text-4xl text-ink mb-3">
        Constitution of the Federal Republic of Nigeria
      </h1>
      <p className="text-ink-400 leading-relaxed mb-8 max-w-2xl">
        Browse passages from the verified, checksummed Constitution source. Each passage
        retains its chapter and source provenance.
      </p>

      <div className="relative mb-8">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-100" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chapters and constitutional topics"
          className="w-full pl-11 pr-4 py-3 border border-ink-100 rounded-lg bg-white text-ink placeholder:text-ink-400 focus:border-brass focus:outline-none"
        />
      </div>

      {loading && <p className="text-ink-400">Loading verified passages...</p>}
      {error && <p role="alert" className="p-4 rounded-lg border border-seal/25 bg-seal/5 text-seal">{error}</p>}
      {!loading && !error && passages.length === 0 && (
        <p className="text-ink-400">No verified Constitution version is published yet.</p>
      )}
      {!loading && !error && passages.length > 0 && chapters.length === 0 && (
        <p className="text-ink-400">No constitutional passage matches “{query}”.</p>
      )}
      <div className="space-y-3">
        {chapters.map(([label, chapterPassages]) => {
          const isOpen = openChapters.has(label) || Boolean(normalizedQuery)
          const heading = chapterPassages[0]?.section_heading
          return (
            <section key={label} className="bg-white border border-ink-100 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleChapter(label)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-paper transition-colors"
              >
                <span>
                  <span className="block font-display text-lg text-ink">{label}</span>
                  {heading && <span className="block mt-1 text-sm text-ink-400">{heading}</span>}
                </span>
                <ChevronDown size={20} className={`shrink-0 text-brass-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="border-t border-ink-100 px-5 py-5 space-y-5">
                  {chapterPassages.map((passage) => (
                    <article key={passage.chunk_id}>
                      <p className="text-ink leading-relaxed whitespace-pre-line">{passage.text}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <p className="text-xs text-ink-400 mt-8">
        Only versions explicitly marked verified and current are shown here.
      </p>
    </div>
  )
}
