'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// IMPORTANT: these are labeled sample profiles for layout/demo purposes only — not
// real, verified lawyers. LegalLens never presents unverified people as real
// bookable attorneys (see DECISIONS.md). The "Join waitlist" action is real; the
// profiles are not.
const PRACTICE_AREAS = [
  'All areas',
  'Criminal law',
  'Employment law',
  'Property & tenancy',
  'Family law',
  'Business law',
]

const SAMPLE_LAWYERS = [
  { initials: 'AO', name: 'Sample profile — A.O.', area: 'Criminal law', years: '12 yrs (sample)' },
  { initials: 'CN', name: 'Sample profile — C.N.', area: 'Employment law', years: '8 yrs (sample)' },
  { initials: 'FI', name: 'Sample profile — F.I.', area: 'Property & tenancy', years: '15 yrs (sample)' },
  { initials: 'BM', name: 'Sample profile — B.M.', area: 'Family law', years: '6 yrs (sample)' },
  { initials: 'TU', name: 'Sample profile — T.U.', area: 'Business law', years: '10 yrs (sample)' },
  { initials: 'KA', name: 'Sample profile — K.A.', area: 'Criminal law', years: '20 yrs (sample)' },
]

export default function LawyersPage() {
  const [filter, setFilter] = useState('All areas')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const filtered = useMemo(
    () => (filter === 'All areas' ? SAMPLE_LAWYERS : SAMPLE_LAWYERS.filter((l) => l.area === filter)),
    [filter]
  )

  async function handleJoinWaitlist(practiceArea?: string) {
    setStatus('loading')
    setErrorMsg('')
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase.from('lawyer_waitlist').insert({
      user_id: user?.id,
      email: email || user?.email,
      practice_area: practiceArea ?? null,
    })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
      return
    }
    setStatus('done')
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 md:py-14">
      <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-2">
        Find a lawyer
      </p>
      <h1 className="font-display text-4xl text-ink mb-3">Lawyer referrals</h1>
      <p className="text-ink-400 leading-relaxed mb-4 max-w-2xl">
        LegalLens is building a directory of verified lawyers by practice area. It
        isn&apos;t live yet — the profiles below are sample layout only, not real
        people, and the button doesn&apos;t book anything real. Join the waitlist to be
        notified when verified referrals go live.
      </p>

      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-brass/40 bg-brass/5 text-xs font-mono uppercase tracking-wide text-brass-600 mb-10">
        Preview — sample data, not real lawyers
      </div>

      {/* Real waitlist signup */}
      <div className="bg-white border border-ink-100 rounded-lg p-6 mb-10">
        <h2 className="font-display text-xl text-ink mb-1">Join the waitlist</h2>
        <p className="text-ink-400 text-sm mb-4">
          We&apos;ll email you when verified lawyer referrals are available.
        </p>
        {status === 'done' ? (
          <p className="text-ink-600 text-sm font-medium">
            You&apos;re on the list — thanks for your interest.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com (or leave blank to use your account email)"
              className="flex-1 px-4 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brass/50 focus:border-brass text-sm"
            />
            <button
              onClick={() => handleJoinWaitlist()}
              disabled={status === 'loading'}
              className="px-5 py-2 bg-ink text-paper font-medium rounded-lg hover:bg-ink-600 disabled:opacity-50 transition-colors text-sm whitespace-nowrap"
            >
              {status === 'loading' ? 'Joining…' : 'Join waitlist'}
            </button>
          </div>
        )}
        {status === 'error' && (
          <p className="text-seal text-xs mt-2">
            {errorMsg || 'Something went wrong.'} Make sure the lawyer_waitlist table
            exists — see database/waitlist_migration.sql.
          </p>
        )}
      </div>

      {/* Practice area filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {PRACTICE_AREAS.map((area) => (
          <button
            key={area}
            onClick={() => setFilter(area)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === area
                ? 'bg-ink text-paper border-ink'
                : 'border-ink-100 text-ink-400 hover:border-brass/40'
            }`}
          >
            {area}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((lawyer) => (
          <div key={lawyer.name} className="p-6 bg-white border border-ink-100 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-ink-50 flex items-center justify-center font-display text-ink-600 text-sm shrink-0">
                {lawyer.initials}
              </div>
              <div>
                <p className="font-medium text-ink text-sm">{lawyer.name}</p>
                <p className="text-ink-400 text-xs">{lawyer.years}</p>
              </div>
            </div>
            <span className="inline-block text-[10px] uppercase tracking-wide font-mono text-brass-600 border border-brass/30 rounded-full px-2 py-0.5 mb-4">
              {lawyer.area}
            </span>
            <button
              onClick={() => handleJoinWaitlist(lawyer.area)}
              disabled={status === 'loading'}
              className="w-full py-2 border border-ink-100 rounded-lg text-sm font-medium text-ink hover:bg-paper disabled:opacity-50 transition-colors"
            >
              Notify me for this area
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
