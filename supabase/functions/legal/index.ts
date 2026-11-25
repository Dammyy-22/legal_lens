// Supabase Edge Function: GET /functions/v1/legal?mode=search&q=...&limit=20&offset=0
//                          GET /functions/v1/legal?mode=constitution

import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildCorsHeaders } from '../_shared/cors.mjs'
import { enforceRateLimit, rateLimitHeaders } from '../_shared/rate-limit.mjs'

const LEGAL_RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>()
const LEGAL_RATE_LIMIT = { maxRequests: 60, windowSeconds: 60 }

interface LegalSearchResult {
  chunk_id: string
  source_id: string
  version_id: string
  source_title: string
  source_url: string
  jurisdiction: string
  document_type: string
  authority_level: string
  version_label: string
  section_label: string
  section_heading: string | null
  status: string
  effective_date: string | null
  text: string
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req, 'GET, OPTIONS')
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401, corsHeaders)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders)
  }

  const rateLimit = await enforceRateLimit(
    supabase,
    user.id,
    'search',
    LEGAL_RATE_LIMIT,
    LEGAL_RATE_BUCKETS,
  )
  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: 'Too many search requests. Please wait a moment before trying again.' },
      429,
      corsHeaders,
      rateLimitHeaders(rateLimit),
    )
  }

  const url = new URL(req.url)
  const mode = url.searchParams.get('mode')

  try {
    if (mode === 'constitution') {
      const { data: rpcResults, error: rpcError } = await supabase.rpc('get_verified_constitution')
      if (!rpcError && Array.isArray(rpcResults)) {
        return jsonResponse(rpcResults as LegalSearchResult[], 200, corsHeaders)
      }
      if (rpcError && rpcError.code !== 'PGRST202') {
        throw rpcError
      }

      const { chunks, versionsById, sourcesById, sectionsById } = await loadVerifiedCorpus(supabase)
      const results = chunks
        // deno-lint-ignore no-explicit-any
        .map((chunk: any) => toResult(chunk, versionsById, sourcesById, sectionsById))
        .filter(
          (r: LegalSearchResult | null): r is LegalSearchResult =>
            r !== null && r.source_title.toLowerCase().includes('constitution')
        )
      return jsonResponse(results, 200, corsHeaders)
    }

    if (mode === 'search') {
      const q = url.searchParams.get('q')?.trim()
      if (!q || q.length < 2 || q.length > 500) {
        return jsonResponse({ error: 'q must be between 2 and 500 characters' }, 400, corsHeaders)
      }
      const jurisdiction = url.searchParams.get('jurisdiction')?.trim() || null
      const documentType = url.searchParams.get('document_type') || null
      const authorityLevel = url.searchParams.get('authority_level') || null
      const documentTypes = new Set([
        'constitution',
        'legislation',
        'regulation',
        'case_law',
        'agency_guidance',
        'secondary_commentary',
      ])
      const authorityLevels = new Set(['primary', 'institutional', 'secondary'])
      if (jurisdiction && (jurisdiction.length > 100 || /[\r\n]/.test(jurisdiction))) {
        return jsonResponse({ error: 'jurisdiction must be 100 characters or fewer' }, 400, corsHeaders)
      }
      if (documentType && !documentTypes.has(documentType)) {
        return jsonResponse({ error: 'document_type is invalid' }, 400, corsHeaders)
      }
      if (authorityLevel && !authorityLevels.has(authorityLevel)) {
        return jsonResponse({ error: 'authority_level is invalid' }, 400, corsHeaders)
      }
      const limitParam = Number(url.searchParams.get('limit') ?? '20')
      const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 50) : 20
      const offsetParam = Number(url.searchParams.get('offset') ?? '0')
      const offset = Number.isFinite(offsetParam) ? Math.max(Math.trunc(offsetParam), 0) : 0

      const { data: rpcResults, error: rpcError } = await supabase.rpc('search_legal_corpus', {
        p_query: q,
        p_jurisdiction: jurisdiction,
        p_document_type: documentType,
        p_authority_level: authorityLevel,
        p_limit: limit,
        p_offset: offset,
      })

      if (!rpcError && Array.isArray(rpcResults)) {
        return jsonResponse({ query: q, results: rpcResults as LegalSearchResult[] }, 200, corsHeaders)
      }
      if (rpcError && rpcError.code !== 'PGRST202') {
        throw rpcError
      }

      // Fallback only if SQL RPC has not been applied yet during a rolling deploy.
      const { chunks, versionsById, sourcesById, sectionsById } = await loadVerifiedCorpus(supabase)
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
      const scoredResults: Array<LegalSearchResult & { score: number }> = []

      for (const chunk of chunks) {
        const result = toResult(chunk, versionsById, sourcesById, sectionsById)
        if (!result) continue
        if (jurisdiction && result.jurisdiction.toLowerCase() !== jurisdiction.toLowerCase()) continue
        if (documentType && result.document_type !== documentType) continue
        if (authorityLevel && result.authority_level !== authorityLevel) continue

        const searchable = `${result.source_title} ${result.section_label} ${result.section_heading ?? ''} ${result.text}`.toLowerCase()
        const phraseMatch = searchable.includes(q.toLowerCase()) ? 3 : 0
        const titleMatches = terms.filter((term) => result.source_title.toLowerCase().includes(term)).length
        const headingMatches = terms.filter((term) => (result.section_heading ?? '').toLowerCase().includes(term)).length
        const textMatches = terms.filter((term) => result.text.toLowerCase().includes(term)).length
        const score = phraseMatch + titleMatches * 5 + headingMatches * 3 + textMatches * 2

        if (score === 0) continue
        if (!terms.every((term) => searchable.includes(term)) && score < 3) continue

        scoredResults.push({ ...result, score })
      }

      const results = scoredResults
        .sort((a, b) => b.score - a.score)
        .slice(offset, offset + limit)
        .map(({ score: _score, ...result }) => result)

      return jsonResponse({ query: q, results }, 200, corsHeaders)
    }

    return jsonResponse({ error: 'mode must be "search" or "constitution"' }, 400, corsHeaders)
  } catch (err) {
    console.error('Legal corpus query failed:', err)
    return jsonResponse({ error: 'Failed to query the legal corpus' }, 502, corsHeaders)
  }
})

interface VerifiedCorpus {
  // deno-lint-ignore no-explicit-any
  chunks: any[]
  // deno-lint-ignore no-explicit-any
  versionsById: Map<string, any>
  // deno-lint-ignore no-explicit-any
  sourcesById: Map<string, any>
  // deno-lint-ignore no-explicit-any
  sectionsById: Map<string, any>
}

// deno-lint-ignore no-explicit-any
async function loadVerifiedCorpus(supabase: any): Promise<VerifiedCorpus> {
  const { data: versions, error: versionsError } = await supabase
    .from('legal_source_versions')
    .select('id, source_id, version_label, status, effective_date, verified')
    .eq('verified', true)
    .eq('status', 'current')
    .limit(1000)
  if (versionsError) throw versionsError

  // deno-lint-ignore no-explicit-any
  const versionIds = (versions ?? []).map((v: any) => v.id)
  if (versionIds.length === 0) {
    return {
      // deno-lint-ignore no-explicit-any
      chunks: [] as any[],
      // deno-lint-ignore no-explicit-any
      versionsById: new Map<string, any>(),
      // deno-lint-ignore no-explicit-any
      sourcesById: new Map<string, any>(),
      // deno-lint-ignore no-explicit-any
      sectionsById: new Map<string, any>(),
    }
  }
  // deno-lint-ignore no-explicit-any
  const sourceIds = [...new Set((versions ?? []).map((v: any) => v.source_id))]

  const [{ data: sources, error: sourcesError }, { data: sections, error: sectionsError }, { data: chunks, error: chunksError }] =
    await Promise.all([
      supabase.from('legal_sources').select('id, title, source_url, jurisdiction, document_type, authority_level').in('id', sourceIds).limit(1000),
      supabase.from('legal_sections').select('id, label, heading').in('version_id', versionIds).limit(5000),
      supabase.from('document_chunks').select('id, version_id, section_id, text').in('version_id', versionIds).limit(10000),
    ])
  if (sourcesError) throw sourcesError
  if (sectionsError) throw sectionsError
  if (chunksError) throw chunksError

  return {
    chunks: chunks ?? [],
    // deno-lint-ignore no-explicit-any
    versionsById: new Map((versions ?? []).map((v: any) => [v.id, v])),
    // deno-lint-ignore no-explicit-any
    sourcesById: new Map((sources ?? []).map((s: any) => [s.id, s])),
    // deno-lint-ignore no-explicit-any
    sectionsById: new Map((sections ?? []).map((s: any) => [s.id, s])),
  }
}

function toResult(
  // deno-lint-ignore no-explicit-any
  chunk: any,
  // deno-lint-ignore no-explicit-any
  versionsById: Map<string, any>,
  // deno-lint-ignore no-explicit-any
  sourcesById: Map<string, any>,
  // deno-lint-ignore no-explicit-any
  sectionsById: Map<string, any>
): LegalSearchResult | null {
  const version = versionsById.get(chunk.version_id)
  const source = version ? sourcesById.get(version.source_id) : undefined
  const section = sectionsById.get(chunk.section_id)
  if (!version || !source) return null

  return {
    chunk_id: chunk.id,
    source_id: source.id,
    version_id: version.id,
    source_title: source.title,
    source_url: source.source_url,
    jurisdiction: source.jurisdiction,
    document_type: source.document_type,
    authority_level: source.authority_level,
    version_label: version.version_label,
    section_label: section?.label ?? '',
    section_heading: section?.heading ?? null,
    status: version.status,
    effective_date: version.effective_date ?? null,
    text: chunk.text,
  }
}

function jsonResponse(
  body: unknown,
  status = 200,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, 'Content-Type': 'application/json' },
  })
}
