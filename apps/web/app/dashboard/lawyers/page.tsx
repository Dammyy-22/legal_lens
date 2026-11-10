'use client'

import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  Clipboard,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  UserRoundSearch,
} from 'lucide-react'

const NBA_DIRECTORY_URL = 'https://www.nigerianbar.org.ng/find-a-lawyer'
const NBA_LICENSE_URL = 'https://digital-license.nigerianbar.online/license/verify/'
const NBA_CONTACT_URL = 'https://www.nigerianbar.org.ng/contact'

const STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
]

const PRACTICE_AREAS = [
  {
    id: 'criminal',
    label: 'Criminal law / arrest',
    detail: 'Arrest, police matters, bail, criminal charges',
    checklist: ['Arrest or charge documents, if available', 'Dates, station or court, and next hearing date', 'A short timeline and a safe way to contact you'],
    questions: ['Do you regularly handle criminal defence in this state?', 'What should I do before the next police or court date?', 'What are your fees and what do they cover?'],
  },
  {
    id: 'employment',
    label: 'Employment / labour',
    detail: 'Unpaid wages, dismissal, workplace disputes',
    checklist: ['Employment contract and staff handbook', 'Payslips, termination letter and relevant messages', 'Dates of the events and any internal complaint'],
    questions: ['Have you handled cases before the National Industrial Court?', 'Is there a deadline I need to act before?', 'Can you explain the fee stages in writing?'],
  },
  {
    id: 'property',
    label: 'Property / tenancy',
    detail: 'Land, tenancy, notices, deposits, eviction',
    checklist: ['Tenancy or sale agreement and receipts', 'All notices, letters and messages', 'Property location, dates and any court papers'],
    questions: ['Which state law and court rules apply to this property?', 'What does this notice require me to do, and by when?', 'What costs could arise beyond your professional fee?'],
  },
  {
    id: 'family',
    label: 'Family / child / gender-based violence',
    detail: 'Family matters, child welfare, violence and protection',
    checklist: ['A brief timeline and any existing court orders', 'Relevant identity, relationship or child documents', 'For immediate danger, prioritize safety and contact local emergency support'],
    questions: ['Do you handle this kind of family or protection matter?', 'How will you keep my information confidential?', 'Are there urgent protection or court steps to consider?'],
  },
  {
    id: 'consumer',
    label: 'Consumer / business',
    detail: 'Faulty products, refunds, contracts, business disputes',
    checklist: ['Receipts, contracts, order details and warranty', 'Written complaint and replies from the seller/provider', 'The remedy you requested and any response deadline'],
    questions: ['Is this best handled through negotiation, the regulator or court?', 'What evidence should I preserve?', 'Can you explain the likely cost before I proceed?'],
  },
  {
    id: 'other',
    label: 'Other legal matter',
    detail: 'A different issue or not sure which area applies',
    checklist: ['A one-page timeline of what happened', 'Relevant notices, agreements or official letters', 'Your next deadline or court date'],
    questions: ['Is this within your area of practice?', 'If not, can you refer me to a suitable practitioner?', 'What is the next deadline and first step?'],
  },
]

type Resource = {
  title: string
  detail: string
  url: string
  label: string
}

const AREA_RESOURCES: Record<string, Resource[]> = {
  employment: [
    {
      title: 'National Industrial Court of Nigeria',
      detail: 'Official court information. The court handles employment, labour and industrial-relations matters within its jurisdiction; it is not a lawyer directory.',
      url: 'https://www.nicn.gov.ng/',
      label: 'Official court',
    },
  ],
  consumer: [
    {
      title: 'FCCPC consumer complaint portal',
      detail: 'Official channel for consumer complaints. A regulator complaint may not replace legal advice or court action where those are needed.',
      url: 'https://complaints.fccpc.gov.ng/',
      label: 'Official regulator',
    },
    {
      title: 'Federal Competition and Consumer Protection Act',
      detail: 'FCCPA resource page maintained by the Federal Competition and Consumer Protection Commission.',
      url: 'https://fccpc.gov.ng/resources-library/fccpa/',
      label: 'Official legislation resource',
    },
  ],
  family: [
    {
      title: 'FIDA Nigeria state branches',
      detail: 'FIDA is a women-lawyers’ organization with state branches and legal-aid/pro-bono programmes. Contact a branch to ask whether it can assist; eligibility and availability vary.',
      url: 'https://fida.org.ng/branch-activities/',
      label: 'Legal-aid referral',
    },
    {
      title: 'FIDA Nigeria contact details',
      detail: 'The organization publishes its national contact information and can direct enquiries to a state branch.',
      url: 'https://fida.org.ng/contacts/',
      label: 'Organization contact',
    },
  ],
}

export default function LawyersPage() {
  const [state, setState] = useState('')
  const [areaId, setAreaId] = useState('criminal')
  const [lawyerSearch, setLawyerSearch] = useState('')
  const [lawyerSearchCopied, setLawyerSearchCopied] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [lawyerSearchCopyError, setLawyerSearchCopyError] = useState('')

  const area = useMemo(
    () => PRACTICE_AREAS.find((item) => item.id === areaId) ?? PRACTICE_AREAS[0],
    [areaId],
  )
  const resources = AREA_RESOURCES[area.id] ?? []
  const referralMessage = [
    `Hello, I need a referral to a Nigerian lawyer in ${state || '[state or FCT]'}.`,
    `My matter is ${area.label}. Please direct me to an NBA member who handles it and explain how to verify their current licence.`,
  ].join('\n')

  async function copyReferralMessage() {
    setCopyError('')
    try {
      await navigator.clipboard.writeText(referralMessage)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
      setCopyError('Clipboard access was blocked. Select and copy the referral message above manually.')
    }
  }

  async function copyLawyerSearch() {
    const term = lawyerSearch.trim()
    if (!term) return
    setLawyerSearchCopyError('')
    try {
      await navigator.clipboard.writeText(term)
      setLawyerSearchCopied(true)
      window.setTimeout(() => setLawyerSearchCopied(false), 2500)
    } catch {
      setLawyerSearchCopied(false)
      setLawyerSearchCopyError('Clipboard access was blocked. Select and copy the search term manually.')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 md:py-14 animate-ink-in">
      <h1 className="font-display text-4xl text-ink mb-3 sm:text-5xl">Find a lawyer</h1>
      <p className="text-ink-400 leading-relaxed mb-8 max-w-3xl">
        Search by name or enrolment number. LegalLens does not provide live NBA membership
        or licence status.
      </p>

      <section className="rounded-2xl border border-ink-100 bg-white p-6 md:p-8 mb-8">
        <div className="flex items-start gap-3 mb-6">
          <span className="w-11 h-11 shrink-0 rounded-lg bg-brass/10 flex items-center justify-center text-brass-600">
            <UserRoundSearch size={22} />
          </span>
          <div>
            <h2 className="font-display text-2xl text-ink">Search an NBA member</h2>
            <p className="mt-1 text-sm text-ink-400 leading-relaxed">
              Search by full name or enrolment number.
            </p>
          </div>
        </div>
        <p role="status" className="mb-5 rounded-lg border border-brass/25 bg-brass/5 p-3 text-sm text-ink-400">
          In-app verification is unavailable. LegalLens has not checked NBA membership or licence status.
        </p>

        <label htmlFor="lawyer-search" className="block text-sm font-medium text-ink mb-2">
          Lawyer&apos;s full name or enrolment number (optional)
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="lawyer-search"
            value={lawyerSearch}
            onChange={(event) => setLawyerSearch(event.target.value)}
            placeholder="Enter a name or enrolment number"
            autoComplete="off"
            maxLength={160}
            className="min-w-0 flex-1 px-4 py-3 border border-ink-100 rounded-lg bg-white text-ink text-sm placeholder:text-ink-400 focus:border-brass focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void copyLawyerSearch()}
            disabled={!lawyerSearch.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-100 px-4 py-3 text-sm font-medium text-ink hover:bg-paper disabled:opacity-40 transition-colors"
          >
            {lawyerSearchCopied ? <Check size={16} /> : <Clipboard size={16} />}
            {lawyerSearchCopied ? 'Copied' : 'Copy search term'}
          </button>
          <a
            href={NBA_DIRECTORY_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-paper hover:bg-ink-600 transition-colors"
          >
            Optional: NBA directory <ArrowUpRight size={16} />
          </a>
        </div>
        <p className="mt-2 text-xs text-ink-400">
          LegalLens has not checked a lawyer&apos;s identity, membership or licence. The NBA directory is an optional live check.
        </p>
        {lawyerSearchCopyError && <p role="alert" className="mt-2 text-xs text-seal">{lawyerSearchCopyError}</p>}

        <div className="mt-6 grid sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 rounded-lg border border-brass/30 bg-brass/5 p-4">
            <ShieldCheck size={20} className="shrink-0 text-brass-600" />
            <span>
              <span className="block text-sm font-semibold text-ink">Verify the practice licence</span>
              <span className="block mt-1 text-xs text-ink-400 leading-relaxed">
                Check the licence holder&apos;s name and status using its serial number or QR code.
                LegalLens cannot confirm live status.
              </span>
              <a
                href={NBA_LICENSE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-brass-600 underline underline-offset-2"
              >
                Optional: NBA verification portal <ArrowUpRight size={13} />
              </a>
            </span>
          </div>
          <div className="rounded-lg border border-ink-100 p-4">
            <h3 className="text-sm font-semibold text-ink">Before you retain anyone</h3>
            <p className="mt-1 text-xs text-ink-400 leading-relaxed">
              Agree on scope and fees in writing, request receipts, and never share
              passwords, one-time codes or original documents with an unverified contact.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-6 md:p-8 mb-8">
        <div className="flex items-start gap-3 mb-6">
          <span className="w-11 h-11 shrink-0 rounded-lg bg-ink-50 flex items-center justify-center text-ink-600">
            <MapPin size={21} />
          </span>
          <div>
            <h2 className="font-display text-2xl text-ink">Prepare a local referral request</h2>
            <p className="mt-1 text-sm text-ink-400 leading-relaxed">
              Choose a location and matter, then copy a message to send to the NBA.
              LegalLens does not send or store it.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          <label className="block text-sm font-medium text-ink">
            State or FCT
            <select
              value={state}
              onChange={(event) => setState(event.target.value)}
              className="mt-2 block w-full rounded-lg border border-ink-100 bg-white px-3 py-3 text-sm text-ink focus:border-brass focus:outline-none"
            >
              <option value="">Select location</option>
              {STATES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-ink">
            What kind of legal help?
            <select
              value={areaId}
              onChange={(event) => setAreaId(event.target.value)}
              className="mt-2 block w-full rounded-lg border border-ink-100 bg-white px-3 py-3 text-sm text-ink focus:border-brass focus:outline-none"
            >
              {PRACTICE_AREAS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>

        <label htmlFor="referral-message" className="block text-sm font-medium text-ink mb-2">
          Referral message (review it before sending)
        </label>
        <textarea
          id="referral-message"
          readOnly
          rows={4}
          value={referralMessage}
          className="w-full resize-y rounded-lg border border-ink-100 bg-paper/60 px-4 py-3 text-sm text-ink-400 leading-relaxed"
        />
        <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <button
            type="button"
            onClick={() => void copyReferralMessage()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink hover:bg-paper transition-colors"
          >
            {copied ? <Check size={16} /> : <Clipboard size={16} />}
            {copied ? 'Copied' : 'Copy referral message'}
          </button>
          <a
            href={NBA_CONTACT_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-brass-600 underline underline-offset-2"
          >
            Optional: contact the NBA <ArrowUpRight size={15} />
          </a>
        </div>
        {copyError && <p role="alert" className="mt-2 text-xs text-seal">{copyError}</p>}
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-6 md:p-8 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BriefcaseBusiness size={21} className="text-brass-600" />
          <h2 className="font-display text-2xl text-ink">Prepare for your first conversation</h2>
        </div>
        <p className="text-sm text-ink-400 mb-5">{area.detail}</p>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-ink mb-3">Bring or prepare</h3>
            <ul className="space-y-2">
              {area.checklist.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-ink-400 leading-relaxed">
                  <Check size={16} className="mt-0.5 shrink-0 text-brass-600" />{item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink mb-3">Questions to ask</h3>
            <ul className="space-y-2 list-disc list-inside">
              {area.questions.map((item) => (
                <li key={item} className="text-sm text-ink-400 leading-relaxed">{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {resources.length > 0 && (
        <section className="rounded-2xl border border-ink-100 bg-white p-6 md:p-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <HeartHandshake size={21} className="text-brass-600" />
            <h2 className="font-display text-2xl text-ink">Other relevant official support</h2>
          </div>
          <div className="space-y-3">
            {resources.map((resource) => (
              <article
                key={resource.title}
                className="rounded-lg border border-ink-100 p-4"
              >
                <span>
                  <span className="block text-sm font-semibold text-ink">{resource.title}</span>
                  <span className="block mt-1 text-xs text-ink-400 leading-relaxed">{resource.detail}</span>
                  <span className="block mt-2 text-[10px] uppercase tracking-wide font-mono text-brass-600">{resource.label}</span>
                </span>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brass-600 underline underline-offset-2"
                >
                  Optional: open official resource <ArrowUpRight size={13} />
                </a>
              </article>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-ink-400 leading-relaxed">
        For immediate danger or an urgent court deadline, contact emergency services
        or a qualified local lawyer.
      </p>
    </div>
  )
}
