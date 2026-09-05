'use client'

import { useEffect, useState } from 'react'
import { Landmark, Search } from 'lucide-react'
import { getConstitution, type LegalSearchResult } from '@/lib/api-client'

export default function ConstitutionPage() {
  const [sections, setSections] = useState<LegalSearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getConstitution()
      .then(setSections)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Constitution load failed'))
      .finally(() => setLoading(false))
  }, [])

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

      <div className="relative mb-8 opacity-60">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-100" />
        <input
          type="text"
          disabled
          placeholder="Search the law from the Search page"
          className="w-full pl-11 pr-4 py-3 border border-ink-100 rounded-lg bg-ink-50/40 text-ink-400 placeholder:text-ink-400 cursor-not-allowed"
        />
      </div>

      {loading && <p className="text-ink-400">Loading verified passages...</p>}
      {error && <p role="alert" className="p-4 rounded-lg border border-seal/25 bg-seal/5 text-seal">{error}</p>}
      {!loading && !error && sections.length === 0 && (
        <p className="text-ink-400">No verified Constitution version is published yet.</p>
      )}
      <div className="space-y-4">
        {sections.map((section) => (
          <article key={section.chunk_id} className="p-6 bg-white border border-ink-100 rounded-lg">
            <p className="font-mono text-xs uppercase tracking-wide text-brass-600 mb-3">{section.section_label}</p>
            <p className="text-ink leading-relaxed whitespace-pre-line">{section.text}</p>
          </article>
        ))}
      </div>

      <p className="text-xs text-ink-400 mt-8">
        Only versions explicitly marked verified and current are shown here.
      </p>
    </div>
  )
}
