'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-600">LegalLens</h1>
            <div className="space-x-4">
              <Link href="/auth/login" className="text-gray-600 hover:text-gray-900">
                Login
              </Link>
              <Link href="/auth/register" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                Register
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Understand Your Legal Rights
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            AI-powered legal information for Nigeria. Clear, grounded, and backed by sources.
          </p>
          <Link href="/auth/login" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700">
            Get Started
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 py-12">
          <div className="p-6 bg-white rounded-lg shadow">
            <h3 className="text-xl font-bold mb-2">Ask Questions</h3>
            <p className="text-gray-600">
              Get plain-language answers about laws and rights in Nigeria, all backed by real legal sources.
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow">
            <h3 className="text-xl font-bold mb-2">See Sources</h3>
            <p className="text-gray-600">
              Every answer includes citations so you can verify the information independently.
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow">
            <h3 className="text-xl font-bold mb-2">Explore Guidance</h3>
            <p className="text-gray-600">
              Browse curated guidance for common legal situations like workplace issues and tenant rights.
            </p>
          </div>
        </div>

        <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-600">
            <strong>Important:</strong> LegalLens is a legal information tool, not a lawyer. It helps you understand laws and procedures, but does not provide legal advice. Always consult with a qualified attorney for your specific situation.
          </p>
        </div>
      </div>
    </main>
  )
}
