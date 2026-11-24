'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CONSENT_PURPOSES,
  hasCurrentConsent,
  withdrawConsent,
  type ConsentPurpose,
} from '@/lib/consent'

const ROWS: { purpose: ConsentPurpose; title: string; description: string }[] = [
  {
    purpose: CONSENT_PURPOSES.privateDocuments,
    title: 'Private document processing',
    description:
      'Lets us index your uploaded documents and answer questions about them using an AI model.',
  },
  {
    purpose: CONSENT_PURPOSES.drafting,
    title: 'Drafting assistant',
    description: 'Lets us send the description you type to an AI model to prepare a draft.',
  },
]

export default function ConsentSettings() {
  const [granted, setGranted] = useState<Record<string, boolean | null>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const entries = await Promise.all(
      ROWS.map(async (row) => [row.purpose, await hasCurrentConsent(row.purpose)] as const),
    )
    setGranted(Object.fromEntries(entries))
  }, [])

  useEffect(() => {
    let active = true
    Promise.all(ROWS.map(async (row) => [row.purpose, await hasCurrentConsent(row.purpose)] as const))
      .then((entries) => {
        if (active) setGranted(Object.fromEntries(entries))
      })
      .catch(() => {
        if (active) setError('Unable to load your consent settings.')
      })
    return () => {
      active = false
    }
  }, [])

  async function handleWithdraw(purpose: ConsentPurpose) {
    setBusy(purpose)
    setError('')
    try {
      await withdrawConsent(purpose)
      await refresh()
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : 'Unable to withdraw consent.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="bg-white/90 border border-ink-100 rounded-2xl p-6 mt-6">
      <h2 className="font-display text-lg text-ink mb-1">AI processing consent</h2>
      <p className="text-ink-400 text-sm mb-4">
        You give consent when you first upload a document or use the drafting assistant. Withdrawing it
        stops further processing straight away. It does not delete documents you already uploaded; delete
        those from the Documents page.
      </p>
      {error && (
        <p role="alert" className="mb-3 text-sm text-seal">
          {error}
        </p>
      )}
      <ul className="space-y-4">
        {ROWS.map((row) => (
          <li key={row.purpose} className="flex items-start justify-between gap-4 text-sm">
            <div>
              <p className="text-ink font-medium">{row.title}</p>
              <p className="text-ink-400">{row.description}</p>
              <p className="text-ink-400 mt-1">
                Status:{' '}
                {granted[row.purpose] === undefined
                  ? 'checking…'
                  : granted[row.purpose]
                    ? 'consent given'
                    : 'no current consent'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleWithdraw(row.purpose)}
              disabled={busy !== null || granted[row.purpose] !== true}
              className="shrink-0 px-4 py-2 border border-seal/30 text-seal font-medium rounded-lg hover:bg-seal/5 disabled:opacity-50 transition-colors text-sm"
            >
              {busy === row.purpose ? 'Withdrawing…' : 'Withdraw'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
