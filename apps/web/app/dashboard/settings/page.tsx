'use client'

import { useEffect, useState } from 'react'
import { UserCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [userId, setUserId] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '')
      setUserId(data.user?.id ?? '')
      setFullName((data.user?.user_metadata?.full_name as string) ?? '')
    })
  }, [])

  function passwordError(pw: string): string | null {
    if (pw.length < 10) return 'Password must be at least 10 characters'
    if (/^[a-zA-Z]+$/.test(pw) || /^[0-9]+$/.test(pw)) {
      return 'Password must include a mix of letters, numbers, or symbols'
    }
    return null
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }
    const pwErr = passwordError(newPassword)
    if (pwErr) {
      setMessage({ type: 'error', text: pwErr })
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }
    setMessage({ type: 'success', text: 'Password updated.' })
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 md:py-14">
      <p className="font-mono text-xs uppercase tracking-widest text-brass-600 mb-2">
        Settings
      </p>
      <h1 className="font-display text-4xl text-ink mb-8">Account</h1>

      <div className="bg-white border border-ink-100 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <UserCircle size={56} strokeWidth={1.25} className="text-ink-100 shrink-0" />
          <div>
            <p className="font-display text-lg text-ink">{fullName || 'No name on file'}</p>
            <p className="text-ink-400 text-sm">{email || '—'}</p>
          </div>
        </div>
        <dl className="space-y-3 text-sm border-t border-ink-100 pt-4">
          <div className="flex justify-between">
            <dt className="text-ink-400">User ID</dt>
            <dd className="text-ink font-mono text-xs">{userId || '—'}</dd>
          </div>
        </dl>
        <p className="text-xs text-ink-400 mt-4">
          Name, state, city, and phone are set at sign-up. Editing them here isn&apos;t
          available yet.
        </p>
      </div>

      <div className="bg-white border border-ink-100 rounded-lg p-6">
        <h2 className="font-display text-lg text-ink mb-1">Change password</h2>
        <p className="text-ink-400 text-sm mb-4">
          Note: if you signed up with Google, you don&apos;t have a password to change
          here — manage your login through your Google account instead.
        </p>

        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-ink-50 border border-ink-100 text-ink-600'
                : 'bg-seal/5 border border-seal/25 text-seal'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-ink mb-1">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brass/50 focus:border-brass"
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
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-ink text-paper font-medium rounded-lg hover:bg-ink-600 disabled:opacity-50 transition-colors text-sm"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
