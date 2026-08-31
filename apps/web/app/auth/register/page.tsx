'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Real Nigerian states + FCT — a factual, verifiable list (geography doesn't change),
// not fabricated data.
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
]

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function passwordError(pw: string): string | null {
    if (pw.length < 10) return 'Password must be at least 10 characters'
    if (/^[a-zA-Z]+$/.test(pw) || /^[0-9]+$/.test(pw)) {
      return 'Password must include a mix of letters, numbers, or symbols'
    }
    return null
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!fullName.trim()) {
      setError('Full name is required')
      setLoading(false)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }
    const pwErr = passwordError(password)
    if (pwErr) {
      setError(pwErr)
      setLoading(false)
      return
    }

    const supabase = createClient()
    // Extra profile fields are stored in Supabase's built-in user_metadata (no separate
    // profiles table needed for this). They're set once at signup — editing them later
    // would need a small addition to the Settings page, not built yet.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          state: state || null,
          city: city.trim() || null,
          phone: phone.trim() || null,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      setSuccess('Check your email to confirm your account before signing in.')
    } else {
      setSuccess('Registration successful! Redirecting...')
      window.location.href = '/dashboard'
      return
    }
    setLoading(false)
  }

  async function handleGoogleSignUp() {
    setError('')
    const supabase = createClient()
    // Google OAuth sign-ups skip this form entirely — Supabase automatically populates
    // full_name/avatar from the Google profile, but state/city/phone won't be captured
    // this way. Acceptable for now since those are optional profile details, not
    // required for the account to function.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md p-8 bg-white rounded-lg border border-ink-100 shadow-sm animate-ink-in">
        <Link href="/" className="font-display font-semibold text-2xl text-ink">
          LegalLens<span className="text-brass">.</span>
        </Link>
        <p className="text-ink-400 mt-2 mb-8">Create your account</p>

        {error && (
          <div className="mb-4 p-4 bg-seal/5 border border-seal/25 text-seal rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-ink-50 border border-ink-100 text-ink-600 rounded-lg text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-ink mb-1">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brass/50 focus:border-brass"
              placeholder="Ada Okafor"
              required
              disabled={loading}
            />
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-ink mb-1">
                State
              </label>
              <select
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brass/50 focus:border-brass bg-white text-sm"
                disabled={loading}
              >
                <option value="">Select…</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-ink mb-1">
                City
              </label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brass/50 focus:border-brass text-sm"
                placeholder="Ikeja"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-ink mb-1">
              Phone number <span className="text-ink-400 font-normal">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border border-ink-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brass/50 focus:border-brass"
              placeholder="+234 800 000 0000"
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
            <p className="mt-1 text-xs text-ink-400">
              At least 10 characters, not just letters or just numbers
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink mb-1">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-ink-100" />
          <span className="text-xs text-ink-400 font-mono uppercase tracking-wide">or</span>
          <div className="flex-1 h-px bg-ink-100" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignUp}
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

        <div className="mt-6 text-center text-sm">
          <p className="text-ink-400">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-brass-600 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-8 p-4 bg-paper rounded-lg border border-ink-100 text-xs text-ink-400 leading-relaxed">
          <p className="font-medium text-ink mb-1">About LegalLens</p>
          LegalLens is a legal information tool, not a lawyer. We help you understand
          laws and procedures in Nigeria, but do not provide legal advice. Always
          consult a qualified attorney for your specific situation.
        </div>
      </div>
    </div>
  )
}
