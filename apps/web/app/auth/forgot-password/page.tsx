'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    // Supabase's own behavior already avoids leaking account existence — it returns
    // success regardless of whether the email is registered.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-md p-8 bg-white rounded-lg border border-ink-100 shadow-sm animate-ink-in">
        <h1 className="font-display text-3xl text-ink mb-2">Reset your password</h1>

        {submitted ? (
          <div className="mt-4 p-4 bg-ink-50 border border-ink-100 text-ink-600 rounded-lg text-sm">
            If that email is registered, a password reset link has been sent. Check your
            inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brass/50 focus:border-brass"
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-ink text-paper font-medium rounded-lg hover:bg-ink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          <Link href="/auth/login" className="text-brass-600 hover:underline font-medium">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
