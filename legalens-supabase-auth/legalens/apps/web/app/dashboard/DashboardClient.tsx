'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DashboardClient({ email }: { email: string }) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-600">LegalLens</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700 text-sm">{email}</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to LegalLens</h2>
          <p className="text-gray-600">
            You&apos;re logged in and ready to explore legal information in Nigeria.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">❓</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Ask a Question</h3>
            <p className="text-gray-600 mb-4">
              Ask about laws, rights, and procedures in Nigeria. Get grounded, cited answers.
            </p>
            <button className="text-blue-600 hover:text-blue-700 font-medium">Ask Now →</button>
          </div>

          <div className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">🔍</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Search Laws</h3>
            <p className="text-gray-600 mb-4">
              Search the corpus of Nigerian laws, acts, and regulations with semantic understanding.
            </p>
            <button className="text-blue-600 hover:text-blue-700 font-medium">Search →</button>
          </div>

          <div className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">📄</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Upload Document</h3>
            <p className="text-gray-600 mb-4">
              Upload your own documents and ask questions about them with reference to legal sources.
            </p>
            <button className="text-blue-600 hover:text-blue-700 font-medium">Upload →</button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">🚀 Coming Soon</h3>
          <ul className="space-y-2 text-gray-700">
            <li>✓ AI Legal Assistant with real-time chat</li>
            <li>✓ Comprehensive legal search with filtering</li>
            <li>✓ Rights Explorer for common scenarios (stop by police, tenant rights, etc.)</li>
            <li>✓ Document Q&A with page citations</li>
            <li>✓ Conversation history and saved searches</li>
          </ul>
        </div>

        <div className="mt-12 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>⚠️ Important Disclaimer:</strong> LegalLens is an AI-powered legal
            information tool for educational purposes. It is not a lawyer and does not
            provide legal advice. Always consult with a qualified attorney for legal
            matters affecting your rights or obligations.
          </p>
        </div>
      </main>
    </div>
  )
}
