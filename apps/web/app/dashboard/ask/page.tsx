'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { AlertTriangle, History, LoaderCircle, MessageSquarePlus, Send } from 'lucide-react'
import { askLegalQuestion, type AskCitation } from '@/lib/api-client'
import { CONSENT_PURPOSES, ensureConsent, hasCurrentConsent } from '@/lib/consent'
import { createClient } from '@/lib/supabase/client'
import { motion, useReducedMotion } from 'motion/react'

type ConversationSummary = {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

type ThreadTurn = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: AskCitation[]
  uncertain: boolean
  risk_level: 'standard' | 'high_risk'
  answer_mode?: 'generated' | 'source_extract'
}

type ChunkRelationRow = {
  id: string
  section?: { label?: string; heading?: string | null } | Array<{ label?: string; heading?: string | null }> | null
  version?:
    | { source?: { title?: string; source_url?: string } | Array<{ title?: string; source_url?: string }> | null }
    | Array<{ source?: { title?: string; source_url?: string } | Array<{ title?: string; source_url?: string }> | null }>
    | null
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default function AskPage() {
  const reduceMotion = useReducedMotion()
  const searchParams = useSearchParams()
  const [question, setQuestion] = useState(() => searchParams.get('prompt') ?? '')
  const [providerConsent, setProviderConsent] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const [turns, setTurns] = useState<ThreadTurn[]>([])
  const [recentConversations, setRecentConversations] = useState<ConversationSummary[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    const supabase = createClient()

    hasCurrentConsent(CONSENT_PURPOSES.legalQa).then((current) => {
      if (active && current) setProviderConsent(true)
    })

    supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (active && Array.isArray(data)) {
          setRecentConversations(data as ConversationSummary[])
        }
      })

    return () => {
      active = false
    }
  }, [])

  async function refreshConversations() {
    const supabase = createClient()
    const { data } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(8)
    if (Array.isArray(data)) {
      setRecentConversations(data as ConversationSummary[])
    }
  }

  async function loadConversation(targetId: string) {
    setLoadingThread(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: msgRows, error: msgError } = await supabase
        .from('messages')
        .select('id, role, content, risk_level, is_uncertain, created_at')
        .eq('conversation_id', targetId)
        .order('created_at', { ascending: true })
        .limit(40)
      if (msgError) throw msgError

      const safeMessages = (msgRows ?? []).filter(
        (m): m is {
          id: string
          role: 'user' | 'assistant'
          content: string
          risk_level: 'standard' | 'high_risk'
          is_uncertain: boolean
          created_at: string
        } => m.role === 'user' || m.role === 'assistant',
      )

      const assistantIds = safeMessages.filter((m) => m.role === 'assistant').map((m) => m.id)
      const citationMap = new Map<string, AskCitation[]>()

      if (assistantIds.length > 0) {
        const { data: citeRows } = await supabase
          .from('citations')
          .select('message_id, chunk_id')
          .in('message_id', assistantIds)

        const chunkIds = [...new Set((citeRows ?? []).map((row) => row.chunk_id).filter(Boolean))]
        const chunkMetaMap = new Map<string, AskCitation>()

        if (chunkIds.length > 0) {
          const { data: chunkRows } = await supabase
            .from('document_chunks')
            .select(
              'id, section:legal_sections(label, heading), version:legal_source_versions(source:legal_sources(title, source_url))',
            )
            .in('id', chunkIds)

          for (const row of (chunkRows ?? []) as ChunkRelationRow[]) {
            const section = firstRelation(row.section)
            const version = firstRelation(row.version)
            const source = firstRelation(version?.source)
            chunkMetaMap.set(row.id, {
              chunk_id: row.id,
              source_title: source?.title ?? 'Verified legal source',
              section_label: section?.label ?? 'Section',
              section_heading: section?.heading ?? null,
              source_url: source?.source_url ?? '',
            })
          }
        }

        for (const cite of citeRows ?? []) {
          const meta = chunkMetaMap.get(cite.chunk_id)
          if (!meta) continue
          const existing = citationMap.get(cite.message_id) ?? []
          existing.push(meta)
          citationMap.set(cite.message_id, existing)
        }
      }

      setConversationId(targetId)
      setTurns(
        safeMessages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citations: citationMap.get(m.id) ?? [],
          uncertain: Boolean(m.is_uncertain),
          risk_level: m.risk_level === 'high_risk' ? 'high_risk' : 'standard',
        })),
      )
    } catch (loadErr) {
      setError(loadErr instanceof Error ? loadErr.message : 'Unable to load conversation history.')
    } finally {
      setLoadingThread(false)
    }
  }

  function startNewConversation() {
    setConversationId(undefined)
    setTurns([])
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuestion = question.trim()
    if (trimmedQuestion.length < 3) return
    if (!providerConsent) {
      setError('Please confirm consent to AI processing before submitting your question.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await ensureConsent(CONSENT_PURPOSES.legalQa)
      const answer = await askLegalQuestion(trimmedQuestion, conversationId)
      setConversationId(answer.conversation_id)
      setTurns((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: trimmedQuestion,
          citations: [],
          uncertain: false,
          risk_level: 'standard',
        },
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: answer.answer,
          citations: answer.citations,
          uncertain: answer.uncertain,
          risk_level: answer.risk_level,
          answer_mode: answer.answer_mode,
        },
      ])
      setQuestion('')
      void refreshConversations()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Question failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 md:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass-600">Legal research</p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-ink">Ask a legal question</h1>
        </div>
        {conversationId && (
          <button
            type="button"
            onClick={startNewConversation}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-ink-100 bg-white px-3.5 py-2 text-xs font-medium text-ink transition-colors hover:border-brass/50"
          >
            <MessageSquarePlus size={15} />
            New conversation
          </button>
        )}
      </div>
      <p className="mb-8 mt-3 max-w-2xl leading-7 text-ink-400">
        Describe what you need to know. Ask follow-up questions in the same thread and review
        every cited statutory passage; available coverage may be limited.
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

      {recentConversations.length > 0 && (
        <section aria-label="Recent conversations" className="mb-6 rounded-xl border border-ink-100 bg-white/80 p-4">
          <div className="mb-2.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-brass-600">
            <History size={13} />
            <span>Recent threads</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentConversations.map((conv) => {
              const isSelected = conv.id === conversationId
              const label = conv.title?.trim() || `Thread · ${new Date(conv.created_at).toLocaleDateString()}`
              return (
                <button
                  key={conv.id}
                  type="button"
                  disabled={loadingThread || loading}
                  onClick={() => void loadConversation(conv.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    isSelected
                      ? 'border-ink bg-ink text-white'
                      : 'border-ink-100 bg-paper/60 text-ink-400 hover:border-brass/40 hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {loadingThread && (
        <div role="status" className="mb-6 flex items-center gap-2 rounded-xl border border-ink-100 bg-white p-4 text-sm text-ink-400">
          <LoaderCircle size={16} className="animate-spin" />
          Loading conversation history…
        </div>
      )}

      {turns.length > 0 && (
        <div className="mb-6 space-y-4">
          {turns.map((turn) =>
            turn.role === 'user' ? (
              <div
                key={turn.id}
                className="ml-auto max-w-2xl rounded-xl border border-ink/15 bg-ink px-4 py-3 text-sm leading-relaxed text-white shadow-sm"
              >
                {turn.content}
              </div>
            ) : (
              <motion.article
                key={turn.id}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.2, 0.75, 0.25, 1] }}
                className="rounded-xl border border-ink-100 bg-white p-5 shadow-sm sm:p-6"
              >
                {turn.risk_level === 'high_risk' && (
                  <div className="mb-5 flex items-start gap-2 rounded-lg bg-seal/5 p-3 text-sm text-seal">
                    <AlertTriangle size={18} className="shrink-0" />
                    <span>This may be urgent. Prioritize your immediate safety and contact qualified local support.</span>
                  </div>
                )}
                <p className="whitespace-pre-line leading-relaxed text-ink">{turn.content}</p>
                {turn.answer_mode === 'source_extract' ? (
                  <p className="mt-5 rounded-lg border border-brass-600/20 bg-brass-600/5 p-3 text-sm text-ink-400">
                    These are direct source excerpts, not an AI assessment of how the law applies to your situation.
                  </p>
                ) : turn.uncertain ? (
                  <p className="mt-5 text-sm text-ink-400">
                    This answer has uncertainty or partial citation coverage. Verify directly against the primary source.
                  </p>
                ) : null}
                {turn.citations.length > 0 && (
                  <div className="mt-6 border-t border-ink-100 pt-5">
                    <p className="mb-3 font-mono text-xs uppercase tracking-widest text-brass-600">Sources used</p>
                    <ul className="space-y-2">
                      {turn.citations.map((citation, index) => (
                        <motion.li
                          key={`${turn.id}-${citation.chunk_id}`}
                          initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.35, delay: 0.15 + index * 0.06, ease: [0.2, 0.75, 0.25, 1] }}
                          className="border-l-2 border-brass/40 pl-3 text-sm text-ink-400 transition-colors hover:border-brass hover:text-ink"
                        >
                          <span>{citation.source_title} · {citation.section_label}</span>
                          {/^https?:\/\//i.test(citation.source_url) && (
                            <>
                              {' · '}
                              <a
                                href={citation.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-brass-600 underline underline-offset-2 hover:text-ink"
                              >
                                Open source
                              </a>
                            </>
                          )}
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.article>
            ),
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-ink-100 bg-white p-4 shadow-sm sm:p-5">
        <label htmlFor="legal-question" className="sr-only">Your legal question</label>
        <textarea
          id="legal-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={
            turns.length > 0
              ? 'Ask a follow-up question in this conversation…'
              : 'For example: What does the Constitution say about the right to fair hearing?'
          }
          rows={4}
          maxLength={2000}
          className="w-full resize-y bg-transparent text-ink leading-relaxed placeholder:text-ink-400 focus:outline-none"
        />
        <label className="flex items-start gap-2.5 pb-3 text-xs leading-relaxed text-ink-400">
          <input
            type="checkbox"
            checked={providerConsent}
            onChange={(event) => setProviderConsent(event.target.checked)}
            className="mt-0.5 rounded border-ink-200 text-ink focus:ring-brass"
          />
          <span>
            I consent to sending my legal question through zero-data-retention AI providers to explain
            verified sources (I can withdraw this consent in Settings). Avoid including names, account
            numbers or other personal details.
          </span>
        </label>
        <div className="flex items-center justify-between gap-4 pt-3 border-t border-ink-100">
          <span className="text-xs text-ink-400">{question.length}/2000</span>
          <button
            type="submit"
            disabled={loading || !providerConsent || question.trim().length < 3}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-4 py-2.5 font-medium text-white transition-colors hover:bg-ink-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Checking sources' : turns.length > 0 ? 'Send follow-up' : 'Ask'}
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

      <p className="mt-8 text-xs text-ink-400">
        LegalLens provides legal information, not legal advice. Consult a qualified lawyer
        for decisions affecting your rights or obligations.
      </p>
    </div>
  )
}
