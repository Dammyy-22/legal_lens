'use client'

import { useState, type FormEvent } from 'react'
import {
  Copy,
  Download,
  FilePenLine,
  FileText,
  LoaderCircle,
  WandSparkles,
} from 'lucide-react'
import {
  draftCorrespondence,
  type DraftDocumentResponse,
  type DraftType,
} from '@/lib/api-client'
import { CONSENT_PURPOSES, ensureConsent } from '@/lib/consent'

const DRAFT_OPTIONS: { value: DraftType; label: string; description: string }[] = [
  {
    value: 'information_request',
    label: 'Request information or records',
    description: 'A neutral request for details or copies of records.',
  },
  {
    value: 'repair_request',
    label: 'Report a repair issue',
    description: 'A polite request to inspect or address a reported repair issue.',
  },
  {
    value: 'consumer_complaint',
    label: 'Write to a seller or service provider',
    description: 'Describe a problem and request a response or proposed resolution.',
  },
  {
    value: 'workplace_records',
    label: 'Request workplace records or clarification',
    description: 'A neutral request for employment records or an explanation.',
  },
  {
    value: 'meeting_follow_up',
    label: 'Summarize a conversation',
    description: 'Record discussion points you want the recipient to confirm.',
  },
]

export default function DraftingPage() {
  const [draftType, setDraftType] = useState<DraftType>('information_request')
  const [recipient, setRecipient] = useState('')
  const [facts, setFacts] = useState('')
  const [providerConsent, setProviderConsent] = useState(false)
  const [result, setResult] = useState<DraftDocumentResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!providerConsent) {
      setError('Confirm that your description may be sent to OpenRouter before continuing.')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    setCopyStatus('')
    try {
      await ensureConsent(CONSENT_PURPOSES.drafting)
      setResult(await draftCorrespondence(draftType, recipient, facts))
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : 'Unable to prepare this draft.')
    } finally {
      setLoading(false)
    }
  }

  async function copyDraft() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.draft)
      setCopyStatus('Draft copied.')
    } catch (copyError) {
      console.error('Could not copy generated correspondence:', copyError)
      setCopyStatus('Clipboard access was blocked. Select and copy the draft manually.')
    }
  }

  function downloadDraft() {
    if (!result) return
    const blob = new Blob([result.draft], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'legallens-preliminary-correspondence.txt'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="workspace-enter mx-auto max-w-4xl px-5 py-8 sm:px-8 md:py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass-600">OpenRouter-powered writing assistant</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-ink">Prepare correspondence</h1>
      <p className="mb-7 mt-3 max-w-3xl leading-7 text-ink-400">
        Create a preliminary, plain-language message from facts you provide. This tool
        does not create contracts, court documents, legal notices, or legal advice.
      </p>

      <aside className="mb-6 rounded-xl border border-seal/20 bg-white p-4 text-sm leading-6 text-ink-400">
        <strong className="font-semibold text-ink">Protect private information.</strong>{' '}
        Your description is sent through OpenRouter to the selected model provider for generation. Avoid account numbers,
        identity documents, health details, children&apos;s information, or anything you
        would not share with an AI provider. Drafts are not saved by LegalLens.
      </aside>

      {error && <p role="alert" className="mb-5 rounded-lg border border-seal/25 bg-seal/5 p-4 text-sm text-seal">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-ink-100 bg-white p-5 sm:p-7">
        <label className="block text-sm font-medium text-ink">
          What are you writing?
          <select
            value={draftType}
            onChange={(event) => setDraftType(event.target.value as DraftType)}
            className="mt-1.5 min-h-12 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm font-normal text-ink focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
          >
            {DRAFT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-ink-400">
            {DRAFT_OPTIONS.find((option) => option.value === draftType)?.description}
          </span>
        </label>

        <label className="block text-sm font-medium text-ink">
          Recipient name <span className="font-normal text-ink-400">(optional)</span>
          <input
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            maxLength={120}
            placeholder="Leave blank to use a placeholder"
            className="mt-1.5 min-h-11 w-full rounded-lg border border-ink-100 px-3 text-sm font-normal text-ink placeholder:text-ink-400 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
          />
        </label>

        <label className="block text-sm font-medium text-ink">
          Describe only the facts you want included
          <textarea
            value={facts}
            onChange={(event) => setFacts(event.target.value)}
            minLength={30}
            maxLength={4000}
            required
            rows={7}
            placeholder="What happened, when did it happen, what have you already asked for, and what response would you like? Avoid sensitive personal details."
            className="mt-1.5 w-full resize-y rounded-lg border border-ink-100 px-3 py-3 text-sm font-normal leading-6 text-ink placeholder:text-ink-400 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
          />
          <span className="mt-1 block text-right text-xs font-normal text-ink-400">{facts.length}/4000</span>
        </label>

        <label className="flex items-start gap-3 rounded-lg bg-paper/60 p-3 text-sm leading-5 text-ink-400">
          <input
            type="checkbox"
            checked={providerConsent}
            onChange={(event) => setProviderConsent(event.target.checked)}
            disabled={loading}
            className="mt-1"
          />
          <span>I understand my description is sent through OpenRouter (which we ask to use only zero-data-retention providers) to a model provider, I can withdraw consent in Settings, the output is AI-generated and not lawyer-reviewed, and I will verify every detail before using it.</span>
        </label>

        <button
          type="submit"
          disabled={loading || !providerConsent || facts.trim().length < 30}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <LoaderCircle size={16} className="animate-spin" /> : <WandSparkles size={16} />}
          {loading ? 'Preparing a preliminary draft…' : 'Prepare draft'}
        </button>
      </form>

      {result && (
        <article aria-labelledby="draft-result-heading" className="mt-7 rounded-xl border border-ink-100 bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FilePenLine size={19} className="text-brass-600" />
              <h2 id="draft-result-heading" className="font-display text-xl font-medium text-ink">Preliminary draft</h2>
            </div>
            <span className="rounded-full bg-paper px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-400">
              Generated with {result.provider}
            </span>
          </div>
          <pre className="mt-5 whitespace-pre-wrap break-words rounded-lg bg-paper/60 p-4 font-body text-sm leading-7 text-ink">{result.draft}</pre>
          <p className="mt-4 rounded-lg border border-brass/25 bg-brass/5 p-3 text-sm leading-6 text-ink-400">{result.disclaimer}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void copyDraft()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper">
              <Copy size={15} /> Copy
            </button>
            <button type="button" onClick={downloadDraft} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper">
              <Download size={15} /> Download text
            </button>
            {copyStatus && <span role="status" className="text-xs text-ink-400">{copyStatus}</span>}
          </div>
          <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-ink-400">
            <FileText size={14} className="mt-0.5 shrink-0 text-brass-600" />
            LegalLens does not store this draft. Check names, dates, amounts, and statements carefully. Ask a qualified Nigerian lawyer to review it if the issue may affect your rights or obligations.
          </p>
        </article>
      )}
    </div>
  )
}
