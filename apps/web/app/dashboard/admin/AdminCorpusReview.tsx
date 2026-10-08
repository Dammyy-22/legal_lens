'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface PendingVersion {
  id: string
  version_label: string
  status: string
  processing_status: string
  source_id: string
  source_title: string
  source_url: string
}

interface SectionPreview {
  id: string
  label: string
  heading: string | null
  order_index: number
  text: string
}

export default function AdminCorpusReview() {
  const [versions, setVersions] = useState<PendingVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sections, setSections] = useState<Record<string, SectionPreview[]>>({})
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [verifying, setVerifying] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [verifiedCount, setVerifiedCount] = useState(0)

  useEffect(() => {
    loadPending()
  }, [])

  async function loadPending() {
    setLoading(true)
    setError('')
    const supabase = createClient()

    // RLS's admin policy allows this SELECT to return unverified rows only because
    // the calling user's app_metadata.role is 'admin' — a non-admin running this
    // exact query gets 0 rows, verified directly against Postgres before this UI
    // was built.
    const { data, error: versionsError } = await supabase
      .from('legal_source_versions')
      .select('id, version_label, status, processing_status, source_id')
      .eq('verified', false)
      .order('id')

    if (versionsError) {
      setError(versionsError.message)
      setLoading(false)
      return
    }

    const sourceIds = [...new Set((data ?? []).map((v) => v.source_id))]
    const { data: sources } = await supabase
      .from('legal_sources')
      .select('id, title, source_url')
      .in('id', sourceIds.length > 0 ? sourceIds : ['00000000-0000-0000-0000-000000000000'])

    const sourceById = new Map((sources ?? []).map((s) => [s.id, s]))

    setVersions(
      (data ?? []).map((v) => ({
        ...v,
        source_title: sourceById.get(v.source_id)?.title ?? 'Unknown source',
        source_url: sourceById.get(v.source_id)?.source_url ?? '',
      }))
    )
    setLoading(false)
  }

  async function toggleExpand(versionId: string) {
    if (expanded === versionId) {
      setExpanded(null)
      return
    }
    setExpanded(versionId)
    if (!sections[versionId]) {
      const supabase = createClient()
      const { data, error: sectionsError } = await supabase
        .from('legal_sections')
        .select('id, label, heading, order_index, text')
        .eq('version_id', versionId)
        .order('order_index')

      if (!sectionsError) {
        setSections((prev) => ({ ...prev, [versionId]: data ?? [] }))
      }
    }
  }

  async function handleReview(versionId: string, decision: 'verify' | 'reject') {
    const confirmationText =
      decision === 'verify'
        ? 'Confirm you have read this content and believe it is an accurate, correctly attributed extract before verifying. Verified content becomes available to all users immediately.'
        : 'Reject this version? It will remain hidden from the app and the reviewer notes will be stored for traceability.'

    if (!confirm(confirmationText)) {
      return
    }

    const reviewer = reviewNotes[versionId]?.trim() ?? ''
    if (decision === 'verify') {
      setVerifying(versionId)
    } else {
      setRejecting(versionId)
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error: updateError } = await supabase
      .from('legal_source_versions')
      .update({
        verified: decision === 'verify',
        status: decision === 'verify' ? 'current' : 'rejected',
        review_notes: reviewer || null,
        reviewed_by: user?.email ?? user?.id,
        reviewed_at: new Date().toISOString(),
        verified_by: decision === 'verify' ? (user?.email ?? user?.id) : null,
        verified_at: decision === 'verify' ? new Date().toISOString() : null,
      })
      .eq('id', versionId)

    if (decision === 'verify') {
      setVerifying(null)
    } else {
      setRejecting(null)
    }

    if (updateError) {
      setError(updateError.message)
      return
    }

    if (decision === 'verify') {
      setVerifiedCount((n) => n + 1)
    }
    setVersions((prev) => prev.filter((v) => v.id !== versionId))
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 md:py-14">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck size={22} className="text-brass-600" />
        <p className="font-mono text-xs uppercase tracking-widest text-brass-600">Admin</p>
      </div>
      <h1 className="font-display text-4xl text-ink mb-3">Corpus review</h1>
      <p className="text-ink-400 leading-relaxed mb-10 max-w-2xl">
        Ingested content stays hidden from users until you read and verify it. This is enforced by Row
        Level Security in the database — not just this page&apos;s UI.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-seal/5 border border-seal/25 text-seal rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading && <p className="text-ink-400">Loading...</p>}

      {!loading && versions.length === 0 && (
        <div className="p-8 text-center bg-white border border-ink-100 rounded-lg text-ink-400">
          Nothing pending review right now.
        </div>
      )}

      <div className="space-y-3">
        {versions.map((v) => (
          <div key={v.id} className="bg-white border border-ink-100 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleExpand(v.id)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                {expanded === v.id ? (
                  <ChevronDown size={16} className="text-ink-400 shrink-0" />
                ) : (
                  <ChevronRight size={16} className="text-ink-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-display text-ink truncate">{v.source_title}</p>
                  <p className="text-xs text-ink-400 font-mono truncate">
                    {v.version_label} · {v.processing_status}
                    {v.source_url && !v.source_url.startsWith('http') ? ' · local corpus copy' : ''}
                  </p>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-wide font-mono text-seal border border-seal/30 rounded-full px-2 py-0.5 shrink-0 ml-3">
                Unverified
              </span>
            </button>

            {expanded === v.id && (
              <div className="border-t border-ink-100 px-5 py-4 space-y-4">
                {!sections[v.id] && <p className="text-ink-400 text-sm">Loading sections...</p>}
                {sections[v.id]?.map((s) => (
                  <div key={s.id} className="bg-paper rounded-lg p-4">
                    <p className="font-mono text-xs uppercase tracking-wide text-brass-600 mb-2">
                      {s.label}
                      {s.heading ? ` — ${s.heading}` : ''}
                    </p>
                    <p className="text-ink text-sm leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto">
                      {s.text.slice(0, 2000)}
                      {s.text.length > 2000 ? '…' : ''}
                    </p>
                  </div>
                ))}

                <div className="space-y-3">
                  <label className="block text-xs uppercase tracking-wide font-mono text-ink-400">
                    Reviewer notes
                  </label>
                  <textarea
                    value={reviewNotes[v.id] ?? ''}
                    onChange={(event) =>
                      setReviewNotes((prev) => ({
                        ...prev,
                        [v.id]: event.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="Add a short note about what you checked and any issue found."
                    className="w-full rounded-lg border border-ink-100 bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brass-200"
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleReview(v.id, 'verify')}
                      disabled={verifying === v.id}
                      className="flex items-center gap-2 px-4 py-2 bg-ink text-paper rounded-lg text-sm font-medium hover:bg-ink-600 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle2 size={16} />
                      {verifying === v.id ? 'Verifying…' : 'Verify and publish'}
                    </button>
                    <button
                      onClick={() => handleReview(v.id, 'reject')}
                      disabled={rejecting === v.id}
                      className="px-4 py-2 border border-seal/30 text-seal rounded-lg text-sm font-medium hover:bg-seal/5 disabled:opacity-50 transition-colors"
                    >
                      {rejecting === v.id ? 'Rejecting…' : 'Reject and note'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {verifiedCount > 0 && (
        <p className="text-xs text-ink-400 mt-6">Verified {verifiedCount} item(s) this session.</p>
      )}
    </div>
  )
}
