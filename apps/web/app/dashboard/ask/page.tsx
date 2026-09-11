'use client'

import { FormEvent, useState } from 'react'
import { AlertTriangle, LoaderCircle, MessageCircleQuestion, Send } from 'lucide-react'
import { askLegalQuestion, type AskResponse } from '@/lib/api-client'

export default function AskPage() {
  const [question, setQuestion] = useState('')
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
      <div className="flex items-center gap-3 mb-3">
        <MessageCircleQuestion size={26} className="text-brass-600" />
        <p className="font-mono text-xs uppercase tracking-widest text-brass-600">Legal assistant</p>
      </div>
      <h1 className="font-display text-4xl text-ink mb-3">Ask a question</h1>
      <p className="text-ink-400 leading-relaxed mb-8">
        Ask about Nigerian law in plain language. Answers are limited to verified sources
        and will say when the corpus does not contain enough evidence.
      </p>

      <form onSubmit={handleSubmit} className="bg-white border border-ink-100 rounded-lg p-4 mb-8">
        <label htmlFor="legal-question" className="sr-only">Your legal question</label>
        <textarea
          id="legal-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="For example: What does the Constitution say about the right to fair hearing?"
          rows={5}
          maxLength={2000}
          className="w-full resize-y text-ink leading-relaxed placeholder:text-ink-400 focus:outline-none"
        />
        <div className="flex items-center justify-between gap-4 pt-3 border-t border-ink-100">
          <span className="text-xs text-ink-400">{question.length}/2000</span>
          <button
            type="submit"
            disabled={loading || question.trim().length < 3}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-ink text-paper font-medium disabled:opacity-40"
          >
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Checking sources' : 'Ask'}
          </button>
        </div>
      </form>

      {error && <p role="alert" className="mb-6 p-4 rounded-lg border border-seal/25 bg-seal/5 text-seal">{error}</p>}

      {response && (
        <article className="bg-white border border-ink-100 rounded-lg p-6">
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
