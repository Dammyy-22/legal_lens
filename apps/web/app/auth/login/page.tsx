'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh() // ensures server components re-read the new session cookie
  }

  async function handleGoogleLogin() {
    setError('')
    const supabase = createClient()
    // signInWithOAuth redirects the whole page to Google — there is no further code
    // to run after this call on success; the callback route handles the return trip.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-md p-8 bg-white rounded-lg border border-ink-100 shadow-sm animate-ink-in">
        <Link href="/" className="font-display italic text-2xl text-ink">
          LegalLens<span className="text-brass not-italic">.</span>
        </Link>
        <p className="text-ink-400 mt-2 mb-8">Sign in to your account</p>

        {error && (
          <div className="mb-4 p-4 bg-seal/5 border border-seal/25 text-seal rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brass/50 focus:border-brass"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-ink text-paper font-medium rounded-lg hover:bg-ink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-ink-100" />
          <span className="text-xs text-ink-400 font-mono uppercase tracking-wide">or</span>
          <div className="flex-1 h-px bg-ink-100" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-4 w-full py-2.5 border border-ink-100 rounded-lg font-medium text-ink hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.8 2.73v2.27h2.92c1.71-1.57 2.68-3.88 2.68-6.64z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34C2.44 15.98 5.48 18 9 18z"/>
            <path fill="#FBBC05" d="M3.97 10.71a5.4 5.4 0 010-3.42V4.95H.96a9 9 0 000 8.1l3.01-2.34z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.95l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        <div className="mt-6 space-y-2 text-center text-sm">
          <p className="text-ink-400">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-brass-600 hover:underline font-medium">
              Create one
            </Link>
          </p>
          <p>
            <Link href="/auth/forgot-password" className="text-brass-600 hover:underline font-medium">
              Forgot your password?
            </Link>
          </p>
        </div>

        <div className="mt-8 p-4 bg-paper rounded-lg border border-ink-100 text-xs text-ink-400 leading-relaxed">
          LegalLens provides legal information, not legal advice. Always consult a
          qualified lawyer for your specific situation.
        </div>
      </div>
    </div>
  )
}
