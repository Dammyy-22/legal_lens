'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  function passwordError(pw: string): string | null {
    if (pw.length < 10) return 'Password must be at least 10 characters'
    if (/^[a-zA-Z]+$/.test(pw) || /^[0-9]+$/.test(pw)) {
      return 'Password must include a mix of letters, numbers, or symbols'
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    const pwErr = passwordError(password)
    if (pwErr) {
      setError(pwErr)
      return
    }

    setLoading(true)
    const supabase = createClient()
    // The user arrives here already in a temporary authenticated session established
    // by the reset link Supabase emailed them (via the middleware/server client
    // reading the session cookie) — updateUser sets the new password on that session.
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-md p-8 bg-white rounded-lg border border-ink-100 shadow-sm animate-ink-in">
        <h1 className="font-display text-3xl text-ink mb-2">Set a new password</h1>

        {error && (
          <div className="mb-4 p-4 bg-seal/5 border border-seal/25 text-seal rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink mb-1">
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brass/50 focus:border-brass"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink mb-1">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brass/50 focus:border-brass"
              required
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-ink text-paper font-medium rounded-lg hover:bg-ink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
