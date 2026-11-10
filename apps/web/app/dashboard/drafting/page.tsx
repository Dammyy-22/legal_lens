'use client'

import { useState, type FormEvent } from 'react'
import {
  Copy,
  Download,
  FilePenLine,
  LoaderCircle,
  WandSparkles,
} from 'lucide-react'
import {
  draftCorrespondence,
  type DraftDocumentResponse,
  type DraftType,
} from '@/lib/api-client'

const DRAFT_OPTIONS: { value: DraftType; label: string; description: string }[] = [
  {
    value: 'information_request',
    label: 'Request information or records',
    description: 'Ask for details or records.',
  },
  {
    value: 'repair_request',
    label: 'Report a repair issue',
    description: 'Request a repair.',
  },
  {
    value: 'consumer_complaint',
    label: 'Write to a seller or service provider',
    description: 'Explain a problem and request a response.',
  },
  {
    value: 'workplace_records',
    label: 'Request workplace records or clarification',
    description: 'Request records or clarification.',
  },
  {
    value: 'meeting_follow_up',
    label: 'Summarize a conversation',
    description: 'Ask the recipient to confirm discussion points.',
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
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass-600">Writing assistant</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-ink">Prepare correspondence</h1>
      <p className="mb-7 mt-3 max-w-3xl leading-7 text-ink-400">
        Create a preliminary message—not a contract, court filing, legal notice, or legal advice.
      </p>

      <aside className="mb-6 rounded-xl border border-seal/20 bg-white p-4 text-sm leading-6 text-ink-400">
        <strong className="font-semibold text-ink">Protect private information.</strong>{' '}
        Avoid sensitive details. LegalLens does not save drafts.
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
            placeholder="Include key dates, what happened, earlier requests, and the exact action or outcome you want. Avoid sensitive personal details."
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
          <span>I agree to send my description through OpenRouter to its selected AI provider. The draft is not lawyer-reviewed; I will verify it before use.</span>
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
              <h2 id="draft-result-heading" className="font-display text-xl font-medium text-ink">
                {result.generation_mode === 'template_fallback' ? 'Editable template' : 'Preliminary draft'}
              </h2>
            </div>
            <span className="rounded-full bg-paper px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-400">
              {result.generation_mode === 'template_fallback' ? 'Template' : 'AI-generated'}
            </span>
          </div>
          {result.warning && (
            <p role="status" className="mt-4 rounded-lg border border-brass/25 bg-brass/5 p-3 text-sm text-ink-400">
              {result.warning}
            </p>
          )}
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
        </article>
      )}
    </div>
  )
}
