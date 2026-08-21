'use client'

import { useState } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await apiClient.passwordResetRequest(email)
    } finally {
      // Always show the same confirmation regardless of outcome — the backend
      // deliberately returns an identical response whether or not the email exists,
      // so the UI must not create a distinction here either.
      setSubmitted(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Reset your password</h1>

        {submitted ? (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-sm">
            If that email is registered, a password reset link has been issued. Check
            your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
