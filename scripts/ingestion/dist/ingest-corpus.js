/**
 * Ingest local legal PDFs into the verified-source pipeline as unverified rows.
 * The raw PDFs stay local and are never committed; provenance is recorded through
 * the checksum and local corpus filename until an official URL is supplied.
 */
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
// @ts-expect-error — pdf-parse ships no ESM types for this import path
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_CHUNK_CHARS = 6000;
const DEFAULT_CORPUS_DIR = join(process.cwd(), '..', '..', 'legal corpus');
const SOURCE_METADATA = {
    'Constitution-of-the-Federal-Republic-of-Nigeria-1999-Updated.pdf': {
        title: 'Constitution of the Federal Republic of Nigeria 1999',
        documentType: 'constitution',
        authority: 'Federal Republic of Nigeria',
        jurisdiction: 'Nigeria',
    },
    'Labour Act.pdf': {
        title: 'Labour Act',
        documentType: 'legislation',
        authority: 'Federal Republic of Nigeria',
        jurisdiction: 'Nigeria',
    },
    'Police-Act-2020.pdf': {
        title: 'Police Act 2020',
        documentType: 'legislation',
        authority: 'Federal Republic of Nigeria',
        jurisdiction: 'Nigeria',
    },
    'Federal-Competition-and-Consumer-Protection-Act-2018.pdf': {
        title: 'Federal Competition and Consumer Protection Act 2018',
        documentType: 'legislation',
        authority: 'Federal Republic of Nigeria',
        jurisdiction: 'Nigeria',
    },
    'Lagos-State-Road-Traffic-Law.pdf': {
        title: 'Lagos State Road Traffic Law',
        documentType: 'legislation',
        authority: 'Lagos State Government',
        jurisdiction: 'Nigeria-Lagos',
    },
    'DCRMA-COMPENDIUM_2022.pdf': {
        title: 'DCRMA Compendium 2022',
        documentType: 'agency_guidance',
        authority: 'Nigerian government publication',
        jurisdiction: 'Nigeria',
    },
    'RC-COMPENDIUM-2024.pdf': {
        title: 'RC Compendium 2024',
        documentType: 'agency_guidance',
        authority: 'Nigerian government publication',
        jurisdiction: 'Nigeria',
    },
    'Roles-Rights-Responsibilities-Under-New-Police-Act.pdf': {
        title: 'Roles, Rights and Responsibilities Under the New Police Act',
        documentType: 'secondary_commentary',
        authority: 'Nigerian government publication',
        jurisdiction: 'Nigeria',
    },
};
function requireEnv(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`Missing required environment variable: ${name}`);
    return value;
}
function splitIntoChunks(text) {
    const chunks = [];
    for (let offset = 0; offset < text.length; offset += MAX_CHUNK_CHARS) {
        chunks.push(text.slice(offset, offset + MAX_CHUNK_CHARS).trim());
    }
    return chunks.filter(Boolean);
}
async function main() {
    const corpusDir = process.env.CORPUS_DIR ?? DEFAULT_CORPUS_DIR;
    const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
    const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
    const files = (await readdir(corpusDir)).filter((file) => file.toLowerCase().endsWith('.pdf'));
    if (files.length === 0)
        throw new Error(`No PDF files found in ${corpusDir}`);
    console.log(`Found ${files.length} PDF file(s) in ${corpusDir}`);
    for (const file of files) {
        const metadata = SOURCE_METADATA[file];
        if (!metadata) {
            console.warn(`Skipping ${file}: add metadata before ingesting it`);
            continue;
        }
        const buffer = await readFile(join(corpusDir, file));
        const checksum = createHash('sha256').update(buffer).digest('hex');
        const parsed = await pdfParse(buffer);
        const text = parsed.text.replace(/\s+\n/g, '\n').trim();
        if (text.length < 1000)
            throw new Error(`${file}: extracted text is suspiciously short (${text.length} chars)`);
        const sourceUrl = `local-corpus://${encodeURIComponent(file)}`;
        const { data: existingSource, error: sourceLookupError } = await supabase
            .from('legal_sources')
            .select('id')
            .eq('source_url', sourceUrl)
            .maybeSingle();
        if (sourceLookupError)
            throw sourceLookupError;
        let sourceId;
        if (existingSource) {
            sourceId = existingSource.id;
        }
        else {
            const { data: source, error: sourceError } = await supabase
                .from('legal_sources')
                .insert({
                title: metadata.title,
                jurisdiction: metadata.jurisdiction,
                country: 'Nigeria',
                issuing_authority: metadata.authority,
                document_type: metadata.documentType,
                authority_level: metadata.documentType === 'secondary_commentary' ? 'secondary' : 'primary',
                language: 'en',
                source_url: sourceUrl,
            })
                .select('id')
                .single();
            if (sourceError)
                throw sourceError;
            sourceId = source.id;
        }
        const { data: existing } = await supabase
            .from('legal_source_versions')
            .select('id')
            .eq('source_id', sourceId)
            .eq('checksum_sha256', checksum)
            .maybeSingle();
        if (existing) {
            console.log(`Skipping ${file}: checksum already ingested (${existing.id})`);
            continue;
        }
        const { data: version, error: versionError } = await supabase
            .from('legal_source_versions')
            .insert({
            source_id: sourceId,
            version_label: `local-${new Date().toISOString().slice(0, 10)}-${checksum.slice(0, 8)}`,
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
        const { data: section, error: sectionError } = await supabase
            .from('legal_sections')
            .insert({
            version_id: version.id,
            hierarchy_level: 'chapter',
            label: basename(file, '.pdf'),
            heading: metadata.title,
            order_index: 0,
            text,
        })
            .select('id')
            .single();
        if (sectionError)
            throw sectionError;
        const chunks = splitIntoChunks(text);
        for (let index = 0; index < chunks.length; index++) {
            const embeddingResponse = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: chunks[index] });
            const { error: chunkError } = await supabase.from('document_chunks').insert({
                section_id: section.id,
                version_id: version.id,
                chunk_index: index,
                text: chunks[index],
                embedding: embeddingResponse.data[0].embedding,
            });
            if (chunkError)
                throw chunkError;
        }
        await supabase.from('legal_source_versions').update({ processing_status: 'indexed' }).eq('id', version.id);
        console.log(`Indexed ${file}: ${chunks.length} chunk(s), version ${version.id}, still unverified`);
    }
}
main().catch((error) => {
    console.error('Corpus ingestion failed:', error);
    process.exit(1);
});
