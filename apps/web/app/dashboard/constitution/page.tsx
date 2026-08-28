'use client'

// Structural browse UI for the Constitution of the Federal Republic of Nigeria.
// Deliberately shows NO constitutional text — that must come from a verified,
// ingested source per the build plan's source-verification rules (never invent legal
// text). This page is the shell that real content will populate once ingestion exists.
const CHAPTERS = [
  'Chapter I — General Provisions',
  'Chapter II — Fundamental Objectives and Directive Principles of State Policy',
  'Chapter III — Citizenship',
  'Chapter IV — Fundamental Rights',
  'Chapter V — The Legislature',
  'Chapter VI — The Executive',
  'Chapter VII — The Judicature',
  'Chapter VIII — Federal Capital Territory, Abuja and General Supplementary Provisions',
]

export default function ConstitutionPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10 md:py-14">
      <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-2">
        Primary source
      </p>
      <h1 className="font-display text-4xl text-ink mb-3">
        Constitution of the Federal Republic of Nigeria
      </h1>
      <p className="text-ink-400 leading-relaxed mb-8 max-w-2xl">
        This page will let you browse the Constitution by chapter and section, with
        every clause linked to a verified source document. The actual text is not
        loaded yet — LegalLens never displays legal text that hasn't been ingested from
        a verified, checksummed original, so this shows the structure only.
      </p>

      <div className="relative">
        <input
          type="text"
          disabled
          placeholder="Search will be available once the Constitution is ingested"
          className="w-full px-4 py-3 border border-ink-100 rounded-lg bg-ink-50/40 text-ink-400 placeholder:text-ink-400 cursor-not-allowed mb-8"
        />
      </div>

      <div className="space-y-2">
        {CHAPTERS.map((chapter) => (
          <div
            key={chapter}
            className="flex items-center justify-between px-5 py-4 bg-white border border-ink-100 rounded-lg opacity-60"
          >
            <span className="font-display text-ink">{chapter}</span>
            <span className="text-[10px] uppercase tracking-wide font-mono text-ink-400 border border-ink-100 rounded-full px-2 py-0.5 shrink-0 ml-4">
              Not yet ingested
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-400 mt-8">
        Chapter list shown for navigation only, sourced from the Constitution&apos;s
        published table of contents. Full text will be added once verified against an
        official source, per LegalLens&apos;s source-verification policy.
      </p>
    </div>
  )
}
