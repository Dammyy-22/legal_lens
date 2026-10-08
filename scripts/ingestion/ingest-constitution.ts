/**
 * Ingest the Constitution of the Federal Republic of Nigeria 1999 into the
 * legal_sources / legal_source_versions / legal_sections / document_chunks tables.
 *
 * SOURCE → FETCH → VALIDATE → EXTRACT → CHUNK → EMBED → STORE (as unverified)
 *
 * Run manually, server-side only (needs the Supabase service_role key, which must
 * NEVER be exposed to the browser):
 *
 *   cd scripts/ingestion
 *   npm install
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=... npm run ingest:constitution
 *
 * Everything this script writes is marked `verified = false`. A human must review
 * the ingested chapters and flip that flag (via the Supabase dashboard or a future
 * admin tool) before the AI assistant may cite any of it. This is enforced by RLS in
 * database/schema.sql, not just a convention here.
 *
 * Chapter headings appear first in the table of contents and again in the legal
 * text. The structure helper starts after the constitutional preamble, validates
 * the eight substantive chapter headings in order, and stores schedules separately.
 * The local corpus pipeline may split reliable numbered provisions further.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { createHash } from 'node:crypto'
import pdfParse from 'pdf-parse'
import { splitConstitutionSections } from './constitution-structure.mjs'
const SOURCE_URL = 'https://nigeriarights.gov.ng/files/constitution.pdf'
const EMBEDDING_MODEL = 'text-embedding-3-small' // 1536 dimensions — must match database/schema.sql
const MAX_CHUNK_CHARS = 6000 // keeps each embedding call comfortably under the model's token limit

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required environment variable: ${name}`)
    process.exit(1)
  }
  return v
}

function requireSupabaseUrl(): string {
  const value = requireEnv('SUPABASE_URL')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('SUPABASE_URL must be a valid project URL such as https://your-project-ref.supabase.co')
  }
  if (!url.hostname.endsWith('.supabase.co') || url.pathname !== '/') {
    throw new Error('SUPABASE_URL must be the project API URL, not the Supabase dashboard URL')
  }
  return value.replace(/\/$/, '')
}

async function main() {
  const supabaseUrl = requireSupabaseUrl()
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const skipEmbeddings = process.env.SKIP_EMBEDDINGS === 'true'
  const openaiKey = skipEmbeddings ? undefined : requireEnv('OPENAI_API_KEY')

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null
  if (skipEmbeddings) console.log('SKIP_EMBEDDINGS=true: storing text chunks without vector embeddings.')

  console.log(`Fetching ${SOURCE_URL} ...`)
  const res = await fetch(SOURCE_URL)
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  const checksum = createHash('sha256').update(buffer).digest('hex')
  console.log(`Fetched ${buffer.length} bytes. SHA-256: ${checksum}`)

  console.log('Extracting text...')
  const parsed = await pdfParse(buffer)
  const fullText: string = parsed.text
  if (fullText.length < 10000) {
    // A real Constitution is a long document. A suspiciously short extraction means
    // something went wrong upstream (redirect to an error page, changed URL, etc.) —
    // fail loudly rather than ingest garbage as if it were the Constitution.
    throw new Error(
      `Extracted text is implausibly short (${fullText.length} chars) — refusing to ingest. Check SOURCE_URL is still valid.`
    )
  }

  // --- Upsert the source registry entry ---
  const { data: existingSource } = await supabase
    .from('legal_sources')
    .select('id')
    .eq('source_url', SOURCE_URL)
    .maybeSingle()

  let sourceId: string
  if (existingSource) {
    sourceId = existingSource.id
    console.log(`Using existing legal_sources row ${sourceId}`)
  } else {
    const { data, error } = await supabase
      .from('legal_sources')
      .insert({
        title: 'Constitution of the Federal Republic of Nigeria 1999 (Cap. C23 L.F.N. 2004)',
        jurisdiction: 'Nigeria',
        country: 'Nigeria',
        issuing_authority: 'National Assembly of Nigeria (hosted by National Human Rights Commission)',
        document_type: 'constitution',
        authority_level: 'primary',
        language: 'en',
        source_url: SOURCE_URL,
      })
      .select('id')
      .single()
    if (error) throw error
    sourceId = data.id
    console.log(`Created legal_sources row ${sourceId}`)
  }

  const versionLabel = `ingested-${checksum.slice(0, 8)}-chapters-v3`
  const { data: existingVersion, error: versionLookupError } = await supabase
    .from('legal_source_versions')
    .select('id, checksum_sha256')
    .eq('source_id', sourceId)
    .eq('version_label', versionLabel)
    .maybeSingle()
  if (versionLookupError) throw versionLookupError

  if (existingVersion) {
    const { data: unembeddedChunks, error: unembeddedError } = await supabase
      .from('document_chunks')
      .select('id, text')
      .eq('version_id', existingVersion.id)
      .is('embedding', null)
    if (unembeddedError) throw unembeddedError

    if (unembeddedChunks.length > 0 && openai) {
      console.log(`Generating embeddings for ${unembeddedChunks.length} existing chunks...`)
      for (const chunk of unembeddedChunks) {
        const embedding = (await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: chunk.text,
        })).data[0].embedding
        const { error } = await supabase
          .from('document_chunks')
          .update({ embedding })
          .eq('id', chunk.id)
        if (error) throw error
      }
    }

    const { count, error: countError } = await supabase
      .from('document_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('version_id', existingVersion.id)
    if (countError) throw countError

    if ((count ?? 0) > 0) {
      if (unembeddedChunks.length > 0 && !openai) {
        console.log(
          `An indexed version exists (${existingVersion.id}) with ${unembeddedChunks.length} chunks still missing embeddings. ` +
          'Set SKIP_EMBEDDINGS=false and retry when OpenAI credits are available.',
        )
      } else {
        console.log(`A complete chapters-v3 version already exists (${existingVersion.id}). Nothing to do.`)
      }
      return
    }
    console.log(`Removing incomplete version ${existingVersion.id} so ingestion can resume.`)
    const { error: deleteError } = await supabase
      .from('legal_source_versions')
      .delete()
      .eq('id', existingVersion.id)
    if (deleteError) throw deleteError
  }

  const { data: version, error: versionError } = await supabase
    .from('legal_source_versions')
    .insert({
      source_id: sourceId,
      version_label: versionLabel,
      status: 'unverified',
      processing_status: 'pending',
      checksum_sha256: checksum,
      retrieved_at: new Date().toISOString(),
      verified: false,
    })
    .select('id')
    .single()
  if (versionError) throw versionError
  const versionId = version.id
  console.log(`Created legal_source_versions row ${versionId} (unverified)`)

  const chapters = splitConstitutionSections(fullText)

  console.log(`Located ${chapters.length} substantive chapters/schedule sections.`)
  if (chapters.length < 8 || chapters.some((chapter) => chapter.text.length < 50)) {
    throw new Error('One or more substantive Constitution chapters are missing or unexpectedly short. Refusing to ingest.')
  }

  // --- Store each chapter as a legal_section, sub-chunk if needed, embed, store ---
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i]
    const { data: section, error: sectionError } = await supabase
      .from('legal_sections')
      .insert({
        version_id: versionId,
        hierarchy_level: ch.hierarchyLevel,
        label: ch.label,
        heading: ch.heading,
        order_index: i,
        text: ch.text,
      })
      .select('id')
      .single()
    if (sectionError) throw sectionError

    // Sub-split long chapters so each embedding call stays well under the model's
    // token limit. Sub-chunks share the same section (chapter) for citation
    // purposes — a citation to any sub-chunk still resolves to "Chapter IV", not a
    // fabricated finer-grained section number we can't reliably extract yet.
    const subChunks: string[] = []
    for (let offset = 0; offset < ch.text.length; offset += MAX_CHUNK_CHARS) {
      subChunks.push(ch.text.slice(offset, offset + MAX_CHUNK_CHARS))
    }

    console.log(`  ${ch.label}: ${subChunks.length} chunk(s)`)

    for (let j = 0; j < subChunks.length; j++) {
      const chunkText = subChunks[j]
      const embedding = openai
        ? (await openai.embeddings.create({ model: EMBEDDING_MODEL, input: chunkText })).data[0].embedding
        : null

      const { error: chunkError } = await supabase.from('document_chunks').insert({
        section_id: section.id,
        version_id: versionId,
        chunk_index: j,
        text: chunkText,
        embedding,
      })
      if (chunkError) throw chunkError
    }
  }

  await supabase
    .from('legal_source_versions')
    .update({ processing_status: 'indexed' })
    .eq('id', versionId)

  console.log('\nDone. This version is INDEXED but NOT VERIFIED.')
  console.log(
    `A human must review the ingested chapters and run:\n  update legal_source_versions set verified = true, verified_by = '<name>', verified_at = now(), status = 'current' where id = '${versionId}';\nbefore the AI assistant may cite this content.`
  )
}

main().catch((err) => {
  console.error('Ingestion failed:', err)
  process.exit(1)
})
