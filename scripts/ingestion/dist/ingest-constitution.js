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
 * IMPORTANT — chunking granularity (see DECISIONS.md for the full story):
 * The source PDF's text extraction is inconsistent across chapters. Chapter V
 * retains clean section numbering; Chapter IV (Fundamental Rights — likely the
 * single most-queried chapter) does not. Rather than ship section-level regex
 * parsing that would silently mis-chunk exactly that chapter, this script chunks at
 * CHAPTER granularity, which is reliably extractable from the document's own table
 * of contents. Section-level parsing is a documented follow-up requiring
 * layout-aware PDF extraction, not naive text splitting.
 */
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { createHash } from 'node:crypto';
// @ts-expect-error — pdf-parse ships no ESM types for this import path
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
const SOURCE_URL = 'https://nigeriarights.gov.ng/files/constitution.pdf';
const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dimensions — must match database/schema.sql
const MAX_CHUNK_CHARS = 6000; // keeps each embedding call comfortably under the model's token limit
// Chapter headings as they appear in the Constitution's own table of contents —
// used as split markers. This is structural metadata (a table of contents), not a
// reproduction of substantive legal text.
const CHAPTER_MARKERS = [
    { label: 'Chapter I', heading: 'General Provisions', pattern: /CHAPTER\s+I\b[^\n]*/i },
    { label: 'Chapter II', heading: 'Fundamental Objectives and Directive Principles of State Policy', pattern: /CHAPTER\s+II\b[^\n]*/i },
    { label: 'Chapter III', heading: 'Citizenship', pattern: /CHAPTER\s+III\b[^\n]*/i },
    { label: 'Chapter IV', heading: 'Fundamental Rights', pattern: /CHAPTER\s+IV\b[^\n]*/i },
    { label: 'Chapter V', heading: 'The Legislature', pattern: /CHAPTER\s+V\b[^\n]*/i },
    { label: 'Chapter VI', heading: 'The Executive', pattern: /CHAPTER\s+VI\b[^\n]*/i },
    { label: 'Chapter VII', heading: 'The Judicature', pattern: /CHAPTER\s+VII\b[^\n]*/i },
    { label: 'Chapter VIII', heading: 'Federal Capital Territory, Abuja and General Supplementary Provisions', pattern: /CHAPTER\s+VIII\b[^\n]*/i },
];
function requireEnv(name) {
    const v = process.env[name];
    if (!v) {
        console.error(`Missing required environment variable: ${name}`);
        process.exit(1);
    }
    return v;
}
async function main() {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const openaiKey = requireEnv('OPENAI_API_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const openai = new OpenAI({ apiKey: openaiKey });
    console.log(`Fetching ${SOURCE_URL} ...`);
    const res = await fetch(SOURCE_URL);
    if (!res.ok) {
        throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const checksum = createHash('sha256').update(buffer).digest('hex');
    console.log(`Fetched ${buffer.length} bytes. SHA-256: ${checksum}`);
    console.log('Extracting text...');
    const parsed = await pdfParse(buffer);
    const fullText = parsed.text;
    if (fullText.length < 10000) {
        // A real Constitution is a long document. A suspiciously short extraction means
        // something went wrong upstream (redirect to an error page, changed URL, etc.) —
        // fail loudly rather than ingest garbage as if it were the Constitution.
        throw new Error(`Extracted text is implausibly short (${fullText.length} chars) — refusing to ingest. Check SOURCE_URL is still valid.`);
    }
    // --- Upsert the source registry entry ---
    const { data: existingSource } = await supabase
        .from('legal_sources')
        .select('id')
        .eq('source_url', SOURCE_URL)
        .maybeSingle();
    let sourceId;
    if (existingSource) {
        sourceId = existingSource.id;
        console.log(`Using existing legal_sources row ${sourceId}`);
    }
    else {
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
            .single();
        if (error)
            throw error;
        sourceId = data.id;
        console.log(`Created legal_sources row ${sourceId}`);
    }
    // --- Check for an existing version with this exact checksum (idempotency) ---
    const { data: existingVersion } = await supabase
        .from('legal_source_versions')
        .select('id, checksum_sha256')
        .eq('source_id', sourceId)
        .eq('checksum_sha256', checksum)
        .maybeSingle();
    if (existingVersion) {
        console.log(`A version with this exact checksum already exists (${existingVersion.id}) — the source hasn't changed since last ingestion. Nothing to do.`);
        return;
    }
    const { data: version, error: versionError } = await supabase
        .from('legal_source_versions')
        .insert({
        source_id: sourceId,
        version_label: `ingested-${new Date().toISOString().slice(0, 10)}`,
        status: 'unverified',
        processing_status: 'pending',
        checksum_sha256: checksum,
        retrieved_at: new Date().toISOString(),
        verified: false,
    })
        .select('id')
        .single();
    if (versionError)
        throw versionError;
    const versionId = version.id;
    console.log(`Created legal_source_versions row ${versionId} (unverified)`);
    // --- Split into chapters using the table-of-contents markers ---
    const chapters = [];
    for (let i = 0; i < CHAPTER_MARKERS.length; i++) {
        const current = CHAPTER_MARKERS[i];
        const next = CHAPTER_MARKERS[i + 1];
        const startMatch = current.pattern.exec(fullText);
        if (!startMatch) {
            console.warn(`Could not locate "${current.label}" in the extracted text — skipping.`);
            continue;
        }
        const start = startMatch.index;
        const end = next ? next.pattern.exec(fullText)?.index ?? fullText.length : fullText.length;
        const chapterText = fullText.slice(start, end).trim();
        if (chapterText.length < 50) {
            console.warn(`"${current.label}" extracted suspiciously short — skipping rather than storing garbage.`);
            continue;
        }
        chapters.push({ label: current.label, heading: current.heading, text: chapterText });
    }
    console.log(`Located ${chapters.length} of ${CHAPTER_MARKERS.length} expected chapters.`);
    if (chapters.length === 0) {
        throw new Error('No chapters could be located — the document structure may have changed. Refusing to ingest.');
    }
    // --- Store each chapter as a legal_section, sub-chunk if needed, embed, store ---
    for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        const { data: section, error: sectionError } = await supabase
            .from('legal_sections')
            .insert({
            version_id: versionId,
            hierarchy_level: 'chapter',
            label: ch.label,
            heading: ch.heading,
            order_index: i,
            text: ch.text,
        })
            .select('id')
            .single();
        if (sectionError)
            throw sectionError;
        // Sub-split long chapters so each embedding call stays well under the model's
        // token limit. Sub-chunks share the same section (chapter) for citation
        // purposes — a citation to any sub-chunk still resolves to "Chapter IV", not a
        // fabricated finer-grained section number we can't reliably extract yet.
        const subChunks = [];
        for (let offset = 0; offset < ch.text.length; offset += MAX_CHUNK_CHARS) {
            subChunks.push(ch.text.slice(offset, offset + MAX_CHUNK_CHARS));
        }
        console.log(`  ${ch.label}: ${subChunks.length} chunk(s)`);
        for (let j = 0; j < subChunks.length; j++) {
            const chunkText = subChunks[j];
            const embeddingRes = await openai.embeddings.create({
                model: EMBEDDING_MODEL,
                input: chunkText,
            });
            const embedding = embeddingRes.data[0].embedding;
            const { error: chunkError } = await supabase.from('document_chunks').insert({
                section_id: section.id,
                version_id: versionId,
                chunk_index: j,
                text: chunkText,
                embedding,
            });
            if (chunkError)
                throw chunkError;
        }
    }
    await supabase
        .from('legal_source_versions')
        .update({ processing_status: 'indexed' })
        .eq('id', versionId);
    console.log('\nDone. This version is INDEXED but NOT VERIFIED.');
    console.log(`A human must review the ingested chapters and run:\n  update legal_source_versions set verified = true, verified_by = '<name>', verified_at = now(), status = 'current' where id = '${versionId}';\nbefore the AI assistant may cite this content.`);
}
main().catch((err) => {
    console.error('Ingestion failed:', err);
    process.exit(1);
});
