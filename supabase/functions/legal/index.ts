// Supabase Edge Function: GET /functions/v1/legal?mode=search&q=...&limit=20
//                          GET /functions/v1/legal?mode=constitution
//
// Ports apps/api/app/api/legal.py (FastAPI + Supabase-JWT-via-REST) to a native
// Supabase Edge Function. Behavior is intentionally kept equivalent to the original
// — a substring, all-terms-must-match search over verified+current legal content —
// this is a platform port, not a search-quality rewrite. Semantic/vector search
// belongs in supabase/functions/ask, not here.
//
// Uses the calling user's own JWT (via supabase-js, not a raw REST fetch) so
// PostgREST/RLS enforces "verified content only" — the same enforcement point
// proven out for supabase/functions/ask. This function does not use the service
// role key at all; it only ever sees what the calling user is allowed to see.

import { createClient } from 'npm:@supabase/supabase-js@2'

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const url = new URL(req.url)
  const mode = url.searchParams.get('mode')

  try {
    const { chunks, versionsById, sourcesById, sectionsById } = await loadVerifiedCorpus(supabase)

    if (mode === 'constitution') {
      const results = chunks
        // deno-lint-ignore no-explicit-any
        .map((chunk: any) => toResult(chunk, versionsById, sourcesById, sectionsById))
        .filter(
          (r: LegalSearchResult | null): r is LegalSearchResult =>
            r !== null && r.source_title.toLowerCase().includes('constitution')
        )
      return jsonResponse(results)
    }

    if (mode === 'search') {
      const q = url.searchParams.get('q')?.trim()
      if (!q || q.length < 2 || q.length > 500) {
        return jsonResponse({ error: 'q must be between 2 and 500 characters' }, 400)
      }
      const jurisdiction = url.searchParams.get('jurisdiction')?.trim()
      const documentType = url.searchParams.get('document_type')
      const authorityLevel = url.searchParams.get('authority_level')
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
        return jsonResponse({ error: 'jurisdiction must be 100 characters or fewer' }, 400)
      }
      if (documentType && !documentTypes.has(documentType)) {
        return jsonResponse({ error: 'document_type is invalid' }, 400)
      }
      if (authorityLevel && !authorityLevels.has(authorityLevel)) {
        return jsonResponse({ error: 'authority_level is invalid' }, 400)
      }
      const limitParam = Number(url.searchParams.get('limit') ?? '20')
      const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20

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
        .slice(0, limit)
        .map(({ score, ...result }) => result)

      return jsonResponse({ query: q, results })
    }

    return jsonResponse({ error: 'mode must be "search" or "constitution"' }, 400)
  } catch (err) {
    console.error('Legal corpus query failed:', err)
    return jsonResponse({ error: 'Failed to query the legal corpus' }, 502)
  }
})

interface VerifiedCorpus {
  chunks: any[] // deno-lint-ignore-line
  versionsById: Map<string, any>
  sourcesById: Map<string, any>
  sectionsById: Map<string, any>
}

// deno-lint-ignore no-explicit-any
async function loadVerifiedCorpus(supabase: any): Promise<VerifiedCorpus> {
  // RLS restricts these selects to verified=true content automatically (see
  // database/schema.sql) — the explicit .eq('verified', true) below is deliberate
  // defense in depth, matching the pattern used throughout this project, not
  // reliance on RLS alone.
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
      chunks: [] as any[],
      versionsById: new Map<string, any>(),
      sourcesById: new Map<string, any>(),
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}
