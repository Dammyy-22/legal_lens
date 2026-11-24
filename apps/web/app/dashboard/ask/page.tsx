'use client'

import { FormEvent, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { AlertTriangle, LoaderCircle, Send } from 'lucide-react'
import { askLegalQuestion, type AskResponse } from '@/lib/api-client'
import { motion, useReducedMotion } from 'motion/react'

export default function AskPage() {
  const reduceMotion = useReducedMotion()
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

      <div className="image-card group relative mb-6 h-36 overflow-hidden rounded-xl border border-ink-100 bg-ink shadow-sm">
        <Image
          src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=2400&q=90"
          alt="Courthouse columns"
          fill
          priority
          quality={90}
          sizes="(max-width: 768px) 100vw, 900px"
          className="motion-image object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/55 to-transparent" />
        <p className="absolute inset-y-0 left-5 flex items-center font-display text-2xl text-white">
          Start with the question that matters.
        </p>
      </div>

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
        <p className="pb-3 text-xs text-ink-400">
          Your question is sent through OpenRouter to an AI model (we ask for zero-data-retention
          providers only). Avoid including names, account numbers or other personal details.
        </p>
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

      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 flex items-center gap-3 rounded-xl border border-brass/25 bg-white p-4 text-sm text-ink-400"
        >
          <span className="flex items-end gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="ask-dot h-1.5 w-1.5 rounded-full bg-brass" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </span>
          Searching sources and preparing an answer…
        </div>
      )}

      {error && <p role="alert" className="mb-6 p-4 rounded-lg border border-seal/25 bg-seal/5 text-seal">{error}</p>}

      {response && (
        <motion.article
          key={response.conversation_id ?? response.answer}
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.75, 0.25, 1] }}
          className="rounded-xl border border-ink-100 bg-white p-5 shadow-sm sm:p-6"
        >
          {response.risk_level === 'high_risk' && (
            <div className="flex items-start gap-2 mb-5 p-3 rounded-lg bg-seal/5 text-seal text-sm">
              <AlertTriangle size={18} className="shrink-0" />
              <span>This may be urgent. Prioritize your immediate safety and contact qualified local support.</span>
            </div>
          )}
          <p className="text-ink leading-relaxed whitespace-pre-line">{response.answer}</p>
          {response.answer_mode === 'source_extract' ? (
            <p className="mt-5 rounded-lg border border-brass-600/20 bg-brass-600/5 p-3 text-sm text-ink-400">
              These are direct source excerpts, not an AI assessment of how the law applies to your situation.
            </p>
          ) : response.uncertain ? (
            <p className="mt-5 text-sm text-ink-400">This answer is uncertain because no verified citation was attached.</p>
          ) : null}
          {response.citations.length > 0 && (
            <div className="mt-6 pt-5 border-t border-ink-100">
              <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-3">Sources used</p>
              <ul className="space-y-2">
                {response.citations.map((citation, index) => (
                  <motion.li
                    key={citation.chunk_id}
                    initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.25 + index * 0.08, ease: [0.2, 0.75, 0.25, 1] }}
                    className="border-l-2 border-brass/40 pl-3 text-sm text-ink-400 transition-colors hover:border-brass hover:text-ink"
                  >
                    {citation.source_title} · {citation.section_label}
                  </motion.li>
                ))}
              </ul>
            </div>
          )}
        </motion.article>
      )}

      <p className="mt-8 text-xs text-ink-400">
        LegalLens provides legal information, not legal advice. Consult a qualified lawyer
        for decisions affecting your rights or obligations.
      </p>
    </div>
  )
}
