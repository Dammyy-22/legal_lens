'use client'

import { FormEvent, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, LoaderCircle, Send } from 'lucide-react'
import { askLegalQuestion, type AskResponse } from '@/lib/api-client'

export default function AskPage() {
  const searchParams = useSearchParams()
  const [question, setQuestion] = useState(() => searchParams.get('prompt') ?? '')
  const [response, setResponse] = useState<AskResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuestion = question.trim()
    if (trimmedQuestion.length < 3) return

    setLoading(true)
    setError(null)
    try {
      const answer = await askLegalQuestion(trimmedQuestion, response?.conversation_id)
      setResponse(answer)
      setQuestion('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Question failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 md:py-14">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass-600">Legal research</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-ink">Ask a legal question</h1>
      <p className="mb-8 mt-3 max-w-2xl leading-7 text-ink-400">
        Describe what you need to know. Review the explanation and its cited
        sources; available coverage may be limited.
      </p>

      <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-ink-100 bg-white p-4 shadow-sm sm:p-5">
        <label htmlFor="legal-question" className="sr-only">Your legal question</label>
        <textarea
          id="legal-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="For example: What does the Constitution say about the right to fair hearing?"
          rows={5}
          maxLength={2000}
          className="w-full resize-y bg-transparent text-ink leading-relaxed placeholder:text-ink-400 focus:outline-none"
        />
        <div className="flex items-center justify-between gap-4 pt-3 border-t border-ink-100">
          <span className="text-xs text-ink-400">{question.length}/2000</span>
          <button
            type="submit"
            disabled={loading || question.trim().length < 3}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-4 py-2.5 font-medium text-white transition-colors hover:bg-ink-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Checking sources' : 'Ask'}
          </button>
        </div>
      </form>

      {error && <p role="alert" className="mb-6 p-4 rounded-lg border border-seal/25 bg-seal/5 text-seal">{error}</p>}

      {response && (
        <article className="rounded-xl border border-ink-100 bg-white p-5 shadow-sm sm:p-6">
          {response.risk_level === 'high_risk' && (
            <div className="flex items-start gap-2 mb-5 p-3 rounded-lg bg-seal/5 text-seal text-sm">
              <AlertTriangle size={18} className="shrink-0" />
              <span>This may be urgent. Prioritize your immediate safety and contact qualified local support.</span>
            </div>
          )}
          <p className="text-ink leading-relaxed whitespace-pre-line">{response.answer}</p>
          {response.uncertain && <p className="mt-5 text-sm text-ink-400">This answer is marked uncertain because no verified citation was attached.</p>}
          {response.citations.length > 0 && (
            <div className="mt-6 pt-5 border-t border-ink-100">
              <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-3">Sources used</p>
              <ul className="space-y-2">
                {response.citations.map((citation) => (
                  <li key={citation.chunk_id} className="text-sm text-ink-400">
                    {citation.source_title} · {citation.section_label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      )}

      <p className="mt-8 text-xs text-ink-400">
        LegalLens provides legal information, not legal advice. Consult a qualified lawyer
        for decisions affecting your rights or obligations.
      </p>
    </div>
  )
}
