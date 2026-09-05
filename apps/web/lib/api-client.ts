import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export type SupabaseIdentity = {
  id: string
  role: string
  email: string | null
}

export async function getBackendIdentity(): Promise<SupabaseIdentity> {
  const supabase = createClient()
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) {
    throw sessionError
  }

  if (!session?.access_token) {
    throw new Error('No authenticated Supabase session')
  }

  const response = await fetch(`${API_URL}/api/v1/auth/supabase/me`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Backend identity check failed (${response.status})`)
  }

  return response.json() as Promise<SupabaseIdentity>
}

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

async function getAccessToken() {
  const supabase = createClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) throw error
  if (!session?.access_token) throw new Error('No authenticated Supabase session')
  return session.access_token
}

export async function searchLegalSources(
  query: string,
  limit = 20,
): Promise<LegalSearchResult[]> {
  const token = await getAccessToken()
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  const response = await fetch(`${API_URL}/api/v1/legal/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Legal search failed (${response.status})`)
  }

  const body = (await response.json()) as { results: LegalSearchResult[] }
  return body.results
}

export async function getConstitution(): Promise<LegalSearchResult[]> {
  const token = await getAccessToken()
  const response = await fetch(`${API_URL}/api/v1/legal/constitution`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Constitution load failed (${response.status})`)
  }

  return (await response.json()) as LegalSearchResult[]
}