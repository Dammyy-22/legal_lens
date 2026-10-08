'use client'

import { useState } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Briefcase,
  ChevronDown,
  FileSearch,
  Home,
  Scale,
  ShieldAlert,
  ShoppingBag,
  Stethoscope,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { searchLegalSources, type LegalSearchResult } from '@/lib/api-client'

type SourceLink = {
  title: string
  description: string
  url: string
  kind: 'Primary legislation' | 'Official agency' | 'Official court'
}

type Situation = {
  id: string
  Icon: LucideIcon
  title: string
  note: string
  search: string
  matchPhrases: string[]
  overview: string
  steps: string[]
  sources: SourceLink[]
  jurisdictionNote?: string
}

function constitutionSource(provisions: string): SourceLink {
  return {
    title: `Constitution of the Federal Republic of Nigeria · ${provisions}`,
    description: 'National Human Rights Commission copy · open the text and check the full provision.',
    url: 'https://nigeriarights.gov.ng/files/constitution.pdf',
    kind: 'Primary legislation',
  }
}

const SITUATIONS: Situation[] = [
  {
    id: 'police-stop',
    Icon: ShieldAlert,
    title: 'Stopped by police',
    note: 'Traffic stops, ID checks, searches',
    search: 'personal liberty police',
    matchPhrases: ['personal liberty', 'search of his person'],
    overview:
      'A stop, a search and an arrest are different actions. Stay calm, ask which station or officer is involved and why you are being stopped, and do not physically resist. The Constitution protects dignity and personal liberty; the Police Act sets out further police powers and duties.',
    steps: [
      'Ask calmly for the reason for the stop and the officer’s name or identification, if it is safe to do so.',
      'Do not offer a bribe or physically obstruct an officer. Note the time, place, vehicle details and witnesses when safe.',
      'If property is taken or a search occurs, ask for a record or receipt and contact a lawyer or trusted person.',
    ],
    sources: [
      {
        title: 'Nigeria Police Act 2020',
        description: 'Act text hosted by the Policy and Legal Advocacy Centre (PLAC).',
        url: 'https://placng.org/i/wp-content/uploads/2020/09/Police-Act-2020.pdf',
        kind: 'Primary legislation',
      },
      constitutionSource('sections 34–35 · dignity and personal liberty'),
    ],
  },
  {
    id: 'tenancy',
    Icon: Home,
    title: 'Tenant & landlord',
    note: 'Notices, deposits, repairs, eviction',
    search: 'right to acquire immovable property',
    matchPhrases: ['immovable property'],
    overview:
      'Tenancy rules, notice periods and court processes depend on the state and the agreement. Keep your tenancy agreement, rent receipts, inventory and written messages together. Do not assume a rule from another state applies to your home.',
    steps: [
      'Save the tenancy agreement, rent and deposit receipts, inspection records and all notices.',
      'Ask the other party to put requests, arrears calculations and proposed dates in writing.',
      'If you receive an eviction or court notice, check the deadline promptly with a lawyer or local legal-aid provider.',
    ],
    sources: [
      {
        title: 'Lagos State Government · state-specific tenancy rules',
        description:
          'Official state portal. Tenancy legislation is state-specific; confirm the current law and applicable notice rules for your state.',
        url: 'https://lagosstate.gov.ng/',
        kind: 'Official agency',
      },
      constitutionSource('sections 43–44 · property rights'),
    ],
    jurisdictionNote:
      'The Constitution’s property provisions do not replace a state tenancy law. The linked state portal is for Lagos; other states have different laws and institutions.',
  },
  {
    id: 'workplace',
    Icon: Briefcase,
    title: 'The workplace',
    note: 'Termination, wages, employment disputes',
    search: 'conditions of service wages labour',
    matchPhrases: ['conditions of service', 'wages'],
    overview:
      'Employment rights can depend on the type of worker, contract and applicable statute. Preserve the contract and records before a dispute escalates. The National Industrial Court of Nigeria handles employment and labour matters within its jurisdiction.',
    steps: [
      'Keep your contract, payslips, attendance records and relevant messages or emails.',
      'Request the reason for a termination or pay calculation in writing and note important dates.',
      'Get advice before signing a settlement or waiver, especially if a filing deadline may apply.',
    ],
    sources: [
      {
        title: 'Labour Act',
        description: 'Federal Act text in PLAC’s searchable Laws of Nigeria collection.',
        url: 'https://placng.org/lawsofnigeria/laws/L1.pdf',
        kind: 'Primary legislation',
      },
      {
        title: 'National Industrial Court of Nigeria',
        description: 'Official court information and jurisdiction.',
        url: 'https://www.nicn.gov.ng/',
        kind: 'Official court',
      },
    ],
  },
  {
    id: 'consumer',
    Icon: ShoppingBag,
    title: 'Consumer rights',
    note: 'Refunds, faulty goods, contracts',
    search: 'consumer protection',
    matchPhrases: ['consumer protection', 'consumer rights'],
    overview:
      'For a product or service complaint, keep proof of purchase and describe the problem and the outcome you want in writing. The Federal Competition and Consumer Protection Act is the national consumer-protection statute, and the FCCPC provides a complaint channel.',
    steps: [
      'Keep the receipt, order details, warranty, advertisement and photos or other proof of the defect.',
      'Contact the seller or provider in writing with the date, issue and remedy you are requesting.',
      'If it is not resolved, check the FCCPC complaint process and include the records you kept.',
    ],
    sources: [
      {
        title: 'Federal Competition and Consumer Protection Act 2018',
        description: 'FCCPA resource page maintained by the Federal Competition and Consumer Protection Commission.',
        url: 'https://fccpc.gov.ng/resources-library/fccpa/',
        kind: 'Primary legislation',
      },
      {
        title: 'FCCPC consumer complaint portal',
        description: 'Official complaint portal of the Federal Competition and Consumer Protection Commission.',
        url: 'https://complaints.fccpc.gov.ng/',
        kind: 'Official agency',
      },
    ],
  },
  {
    id: 'arrest',
    Icon: Stethoscope,
    title: 'Arrest & detention',
    note: 'Rights during and after arrest',
    search: 'right to personal liberty arrested',
    matchPhrases: ['personal liberty', 'informed promptly of the reason'],
    overview:
      'If you or someone with you is being arrested or detained now, prioritize safety and contact a lawyer or trusted person. The Constitution addresses personal liberty, being informed of the reason for arrest and access to legal advice. Do not rely on this guide for emergency legal representation.',
    steps: [
      'Ask calmly why the person is being arrested and which station they are being taken to.',
      'Contact a lawyer or trusted person as soon as it is safe; share the station and time of arrest.',
      'Do not sign a statement you cannot read or understand. Ask for an interpreter or legal advice.',
    ],
    sources: [
      constitutionSource('section 35 · personal liberty'),
      {
        title: 'Nigeria Police Act 2020',
        description: 'Act text hosted by the Policy and Legal Advocacy Centre (PLAC).',
        url: 'https://placng.org/lawsofnigeria/laws/P19.pdf',
        kind: 'Primary legislation',
      },
    ],
  },
  {
    id: 'civil-procedure',
    Icon: Scale,
    title: 'Civil procedure',
    note: 'Small claims, filing a case',
    search: 'fair hearing',
    matchPhrases: ['fair hearing'],
    overview:
      'Court forms, filing steps, fees and deadlines are set by the court and jurisdiction handling the case. Identify the correct court and check its current rules before filing; a small-claims process in one state is not automatically available nationwide.',
    steps: [
      'Keep the contract, receipts, timeline and any letters or messages relevant to the dispute.',
      'Confirm which court has jurisdiction and obtain its current forms, fees and filing rules.',
      'Check every notice and filing deadline. Ask the court registry or a lawyer if a deadline is unclear.',
    ],
    sources: [
      {
        title: 'Lagos State Judiciary',
        description: 'Official judiciary portal. Procedures and small-claims rules are jurisdiction-specific.',
        url: 'https://lagosjudiciary.gov.ng/',
        kind: 'Official court',
      },
      constitutionSource('section 36 · fair hearing'),
    ],
    jurisdictionNote:
      'This court link is for Lagos State. Court rules and small-claims procedures differ across Nigeria; verify the rules for the court that will hear your case.',
  },
]

const SOURCE_KIND_STYLES: Record<SourceLink['kind'], string> = {
  'Primary legislation': 'bg-brass/10 text-brass-600',
  'Official agency': 'bg-ink/5 text-ink-400',
  'Official court': 'bg-ink/5 text-ink-400',
}

export default function RightsPage() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [resultsById, setResultsById] = useState<Record<string, LegalSearchResult[]>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorsById, setErrorsById] = useState<Record<string, string>>({})

  async function toggleSituation(situation: Situation) {
    if (openId === situation.id) {
      setOpenId(null)
      return
    }

    setOpenId(situation.id)
    if (Object.prototype.hasOwnProperty.call(resultsById, situation.id) || loadingId === situation.id) return

    setLoadingId(situation.id)
    setErrorsById((current) => {
      const next = { ...current }
      delete next[situation.id]
      return next
    })
    try {
      const results = await searchLegalSources(situation.search, 5)
      const relevantResults = results.filter((result) => {
        const searchableText = result.text.toLowerCase()
        return situation.matchPhrases.some((phrase) => searchableText.includes(phrase))
      })
      setResultsById((current) => ({ ...current, [situation.id]: relevantResults }))
    } catch (searchError) {
      setErrorsById((current) => ({
        ...current,
        [situation.id]: searchError instanceof Error ? searchError.message : 'Could not search verified legal sources.',
      }))
    } finally {
      setLoadingId((current) => current === situation.id ? null : current)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 md:py-14 animate-ink-in">
      <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-2">
        Rights explorer
      </p>
      <h1 className="font-display text-4xl text-ink mb-3 sm:text-5xl">Common situations</h1>
      <p className="text-ink-400 leading-relaxed mb-4 max-w-3xl">
        Choose a situation to search the live, verified legal corpus, read practical
        first steps and open relevant legislation or official services.
      </p>
      <p className="text-sm text-ink-400 leading-relaxed mb-10 max-w-3xl">
        The in-app verified corpus currently includes the Constitution. Other laws below
        link to their publishers or official institutions and are not represented as
        indexed in LegalLens. Tenancy and court procedure vary by state.
      </p>

      <div className="image-card group relative mb-10 h-44 overflow-hidden rounded-2xl border border-ink-100 bg-ink shadow-sm md:h-52">
        <Image
          src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=2400&q=90"
          alt="Courthouse columns in warm light"
          fill
          priority
          quality={90}
          sizes="(max-width: 768px) 100vw, 1100px"
          className="motion-image object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/75 via-ink/25 to-transparent" />
        <p className="absolute bottom-5 left-6 max-w-xs font-display text-xl text-white">
          A field guide for the moments when procedure matters.
        </p>
      </div>

      <div className="space-y-4">
        {SITUATIONS.map((situation) => {
          const { Icon } = situation
          const isOpen = openId === situation.id
          const results = resultsById[situation.id]

          return (
            <article key={situation.id} className="bg-white border border-ink-100 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => void toggleSituation(situation)}
                aria-expanded={isOpen}
                aria-controls={`${situation.id}-details`}
                className="w-full group flex items-center gap-4 p-5 md:p-6 text-left hover:bg-paper/70 transition-colors"
              >
                <span className="w-11 h-11 shrink-0 rounded-lg bg-brass/10 flex items-center justify-center group-hover:bg-ink transition-colors">
                  <Icon size={21} strokeWidth={1.75} className="text-brass-600 group-hover:text-brass-400 transition-colors" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg text-ink">{situation.title}</span>
                  <span className="block mt-1 text-sm text-ink-400">{situation.note}</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-ink-100 px-3 py-1 text-[10px] uppercase tracking-wide font-mono text-brass-600">
                  <FileSearch size={13} />
                  Explore
                </span>
                <ChevronDown size={20} className={`shrink-0 text-brass-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div id={`${situation.id}-details`} className="border-t border-ink-100 px-5 py-6 md:px-6 space-y-7">
                  <div>
                    <h2 className="font-display text-xl text-ink mb-2">Start here</h2>
                    <p className="text-sm text-ink-400 leading-relaxed">{situation.overview}</p>
                    <ol className="mt-4 space-y-2.5 list-decimal list-inside text-sm text-ink-400 leading-relaxed">
                      {situation.steps.map((step) => <li key={step}>{step}</li>)}
                    </ol>
                  </div>

                  {situation.jurisdictionNote && (
                    <div className="flex gap-2.5 rounded-lg border border-brass/20 bg-brass/5 p-4 text-sm text-ink-400 leading-relaxed">
                      <AlertCircle size={18} className="shrink-0 mt-0.5 text-brass-600" />
                      <p>{situation.jurisdictionNote}</p>
                    </div>
                  )}

                  <div>
                    <h2 className="font-display text-xl text-ink mb-3">Search verified passages</h2>
                    {loadingId === situation.id && (
                      <p role="status" className="text-sm text-ink-400">Searching the verified corpus…</p>
                    )}
                    {errorsById[situation.id] && (
                      <p role="alert" className="rounded-lg border border-seal/25 bg-seal/5 p-3 text-sm text-seal">
                        {errorsById[situation.id]}
                      </p>
                    )}
                    {results && results.length === 0 && (
                      <p className="text-sm text-ink-400">
                        No verified passage matched this topic in the current corpus. Use the source links below to check the relevant law or official service.
                      </p>
                    )}
                    {results && results.length > 0 && (
                      <div className="space-y-3">
                        {results.slice(0, 3).map((result) => (
                          <article key={result.chunk_id} className="rounded-lg border border-ink-100 bg-paper/60 p-4">
                            <p className="font-mono text-[10px] uppercase tracking-wide text-brass-600 mb-2">
                              {result.source_title} · {result.section_label}
                              {result.section_heading ? ` · ${result.section_heading}` : ''}
                            </p>
                            <p className="text-sm text-ink-400 leading-relaxed whitespace-pre-line">
                              {getRelevantExcerpt(result.text, situation.matchPhrases)}
                            </p>
                            <a
                              href={result.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 mt-3 text-xs text-brass-600 underline underline-offset-2"
                            >
                              Open source document <ArrowUpRight size={13} />
                            </a>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h2 className="font-display text-xl text-ink mb-3">Relevant laws & official services</h2>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {situation.sources.map((source) => (
                        <a
                          key={source.title}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group rounded-lg border border-ink-100 p-4 hover:border-brass/50 hover:bg-paper/50 transition-colors"
                        >
                          <span className={`inline-block rounded-full px-2 py-1 text-[9px] uppercase tracking-wide font-mono ${SOURCE_KIND_STYLES[source.kind]}`}>
                            {source.kind}
                          </span>
                          <span className="mt-2 flex items-start justify-between gap-2 font-medium text-sm text-ink">
                            {source.title}
                            <ArrowUpRight size={15} className="shrink-0 text-brass-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </span>
                          <span className="block mt-1.5 text-xs text-ink-400 leading-relaxed">{source.description}</span>
                        </a>
                      ))}
                    </div>
                  </div>

                  <Link
                    href={`/dashboard/search?q=${encodeURIComponent(situation.search)}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper hover:bg-ink-600 transition-colors"
                  >
                    Open full results in Legal Search <ArrowUpRight size={16} />
                  </Link>
                </div>
              )}
            </article>
          )
        })}
      </div>

      <p className="text-xs text-ink-400 mt-8 leading-relaxed">
        LegalLens provides legal information, not legal advice. Check the linked source
        for its full text and current status. For urgent detention or court deadlines,
        contact a qualified lawyer or the relevant official service promptly.
      </p>
    </div>
  )
}

function getRelevantExcerpt(text: string, phrases: string[]): string {
  const normalizedText = text.toLowerCase()
  const matchIndex = phrases
    .map((phrase) => normalizedText.indexOf(phrase))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0]

  if (matchIndex === undefined || text.length <= 700) return text

  const contextStart = Math.max(0, matchIndex - 180)
  const previousWordEnd = text.lastIndexOf(' ', contextStart)
  const start = previousWordEnd >= 0 ? previousWordEnd + 1 : 0
  const contextEnd = Math.min(text.length, matchIndex + 520)
  const nextWordEnd = text.indexOf(' ', contextEnd)
  const end = nextWordEnd >= 0 ? nextWordEnd : text.length

  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}
