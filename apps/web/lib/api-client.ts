import { createClient } from '@/lib/supabase/client'

// Calls Supabase Edge Functions directly — FastAPI has been retired (see
// DECISIONS.md). getBackendIdentity() and its FastAPI /supabase/me endpoint are gone
// entirely; Supabase's own supabase.auth.getUser()/getSession() already provide
// identity, so there was never a need for a second identity check through a
// now-nonexistent backend.

export type LegalSearchResult = {
  chunk_id: string
  source_id: string
  version_id: string
  source_title: string
  source_url: string
  version_label: string
  section_label: string
  section_heading: string | null
  status: string
  effective_date: string | null
  text: string
}

async function getAccessToken(): Promise<string> {
  const supabase = createClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) throw error
  if (!session?.access_token) throw new Error('No authenticated Supabase session')
  return session.access_token
}

function functionsUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  return `${base}/functions/v1/${path}`
}

export async function searchLegalSources(
  query: string,
  limit = 20,
): Promise<LegalSearchResult[]> {
  const token = await getAccessToken()
  const params = new URLSearchParams({ mode: 'search', q: query, limit: String(limit) })
  const response = await fetch(`${functionsUrl('legal')}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Legal search failed (${response.status})`)
  }

  const body = (await response.json()) as { results: LegalSearchResult[] }
  return body.results
}

export async function getConstitution(): Promise<LegalSearchResult[]> {
  const token = await getAccessToken()
  const params = new URLSearchParams({ mode: 'constitution' })
  const response = await fetch(`${functionsUrl('legal')}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Constitution load failed (${response.status})`)
  }

  return (await response.json()) as LegalSearchResult[]
}
