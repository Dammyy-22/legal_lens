import { createClient } from 'npm:@supabase/supabase-js@2'
import { Buffer } from 'node:buffer'
import pdfParse from 'npm:pdf-parse@1.1.1'
import { unzipSync } from 'npm:fflate@0.8.2'
import {
  chunkDocumentPages,
  decodeTextFile,
  docxXmlToText,
  MAX_CHUNKS,
  MAX_EXTRACTED_CHARACTERS,
  validateDocxArchiveSize,
} from './logic.mjs'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_PDF_PAGES = 200
const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_BATCH_SIZE = 32

interface UserDocument {
  id: string
  owner_id: string
  original_filename: string
  storage_path: string
  mime_type: string
  file_size_bytes: number
  processing_status: 'uploaded' | 'processing' | 'ready' | 'failed'
}

class DocumentProcessingError extends Error {
  readonly status: number

  constructor(message: string, status = 422) {
    super(message)
    this.status = status
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  if (Number(request.headers.get('content-length') ?? 0) > 10_000) {
    return jsonResponse({ error: 'Request body is too large' }, 413)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !openaiKey) {
    console.error('Document processing environment is incomplete')
    return jsonResponse({ error: 'Document processing is not configured' }, 503)
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization) return jsonResponse({ error: 'Missing Authorization header' }, 401)

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const {
    data: { user },
    error: authError,
  } = await caller.auth.getUser()
  if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: { document_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  if (typeof body.document_id !== 'string' || !isUuid(body.document_id)) {
    return jsonResponse({ error: 'A valid document_id is required' }, 400)
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  let claimedDocument: UserDocument | null = null

  try {
    const { data: document, error: lookupError } = await service
      .from('user_documents')
      .select('id, owner_id, original_filename, storage_path, mime_type, file_size_bytes, processing_status')
      .eq('id', body.document_id)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (lookupError) throw new Error('Could not load document record')
    if (!document) return jsonResponse({ error: 'Document not found' }, 404)
    if (document.processing_status === 'ready') {
      return jsonResponse({ document_id: document.id, status: 'ready' })
    }

    const { data: claimed, error: claimError } = await service
      .from('user_documents')
      .update({ processing_status: 'processing', processing_error: null })
      .eq('id', document.id)
      .eq('owner_id', user.id)
      .in('processing_status', ['uploaded', 'failed'])
      .select('id')
      .maybeSingle()

    if (claimError) throw new Error('Could not start document processing')
    if (!claimed) {
      return jsonResponse({ error: 'Document is already being processed' }, 409)
    }
    claimedDocument = document

    if (
      document.owner_id !== user.id ||
      document.file_size_bytes < 1 ||
      document.file_size_bytes > MAX_FILE_BYTES ||
      !document.storage_path.startsWith(`${user.id}/`)
    ) {
      throw new DocumentProcessingError('Document metadata is invalid.')
    }

    const { data: object, error: downloadError } = await service.storage
      .from('user-documents')
      .download(document.storage_path)
    if (downloadError || !object) throw new Error('Could not download uploaded document')

    const bytes = new Uint8Array(await object.arrayBuffer())
    if (bytes.byteLength !== document.file_size_bytes || bytes.byteLength > MAX_FILE_BYTES) {
      throw new DocumentProcessingError('Uploaded document size does not match its record.')
    }

    const extracted = await extractDocumentText(bytes, document.mime_type)
    let chunks: ReturnType<typeof chunkDocumentPages>
    try {
      chunks = chunkDocumentPages(extracted.pages)
    } catch (error) {
      throw new DocumentProcessingError(
        error instanceof Error ? error.message : 'Could not split document text safely.'
      )
    }
    if (chunks.length > MAX_CHUNKS) {
      throw new DocumentProcessingError(`This document exceeds the ${MAX_CHUNKS}-section processing limit.`)
    }

    const totalCharacters = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0)
    if (totalCharacters > MAX_EXTRACTED_CHARACTERS) {
      throw new DocumentProcessingError('This document contains too much text to process safely.')
    }

    const embeddings = await embedChunks(chunks.map((chunk) => chunk.text), openaiKey)
    const { error: clearError } = await service
      .from('user_document_chunks')
      .delete()
      .eq('document_id', document.id)
      .eq('owner_id', user.id)
    if (clearError) throw new Error('Could not prepare document index')

    const rows = chunks.map((chunk, index) => ({
      document_id: document.id,
      owner_id: user.id,
      chunk_index: chunk.chunk_index,
      page_number: chunk.page_number,
      text: chunk.text,
      embedding: embeddings[index],
    }))

    for (let start = 0; start < rows.length; start += 50) {
      const { error: insertError } = await service
        .from('user_document_chunks')
        .insert(rows.slice(start, start + 50))
      if (insertError) throw new Error('Could not save document index')
    }

    const checksum = await sha256(bytes)
    const { error: readyError } = await service
      .from('user_documents')
      .update({
        processing_status: 'ready',
        processing_error: null,
        page_count: extracted.page_count,
        character_count: extracted.character_count,
        checksum_sha256: checksum,
      })
      .eq('id', document.id)
      .eq('owner_id', user.id)
      .eq('processing_status', 'processing')
    if (readyError) throw new Error('Could not complete document indexing')

    return jsonResponse({
      document_id: document.id,
      status: 'ready',
      sections_indexed: rows.length,
      page_count: extracted.page_count,
    })
  } catch (error) {
    console.error('Document processing failed:', error)
    if (claimedDocument) {
      const message =
        error instanceof DocumentProcessingError
          ? error.message
          : 'Document processing failed. Please try again.'
      const { error: updateError } = await service
        .from('user_document_chunks')
        .delete()
        .eq('document_id', claimedDocument.id)
        .eq('owner_id', user.id)
      if (updateError) console.error('Failed to clean partial document index:', updateError)

      const { error: statusError } = await service
        .from('user_documents')
        .update({ processing_status: 'failed', processing_error: message })
        .eq('id', claimedDocument.id)
        .eq('owner_id', user.id)
        .eq('processing_status', 'processing')
      if (statusError) console.error('Failed to record document processing failure:', statusError)
      const status = error instanceof DocumentProcessingError ? error.status : 502
      return jsonResponse({ error: message }, status)
    }

    return jsonResponse({ error: 'Could not process document' }, 502)
  }
})

async function extractDocumentText(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ pages: Array<{ page_number: number | null; text: string }>; page_count: number | null; character_count: number }> {
  if (mimeType === 'text/plain') {
    let text: string
    try {
      text = decodeTextFile(bytes)
    } catch (error) {
      throw new DocumentProcessingError(
        error instanceof Error ? error.message : 'Text file is invalid.'
      )
    }
    return { pages: [{ page_number: null, text }], page_count: null, character_count: text.length }
  }

  if (mimeType === 'application/pdf') {
    if (!hasPdfSignature(bytes)) throw new DocumentProcessingError('This file is not a valid PDF.')
    const pages: Array<{ page_number: number | null; text: string }> = []
    let pageNumber = 0
    let parsed: { numpages: number }
    try {
      parsed = await pdfParse(Buffer.from(bytes), {
        max: MAX_PDF_PAGES + 1,
        pagerender: async (page: { getTextContent(): Promise<{ items: Array<{ str?: string }> }> }) => {
          pageNumber += 1
          const content = await page.getTextContent()
          const text = content.items.map((item) => item.str ?? '').join(' ')
          pages.push({ page_number: pageNumber, text })
          return text
        },
      })
    } catch {
      throw new DocumentProcessingError('Unable to read this PDF. Check that the file is not damaged or password-protected.')
    }
    if (parsed.numpages > MAX_PDF_PAGES) {
      throw new DocumentProcessingError(`PDFs are limited to ${MAX_PDF_PAGES} pages.`)
    }
    if (pageNumber !== parsed.numpages) {
      throw new DocumentProcessingError('Not all PDF pages could be read.')
    }
    const characterCount = pages.reduce((sum, page) => sum + page.text.length, 0)
    if (characterCount > MAX_EXTRACTED_CHARACTERS) {
      throw new DocumentProcessingError('This PDF contains too much text to process safely.')
    }
    return { pages, page_count: parsed.numpages, character_count: characterCount }
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    if (!hasZipSignature(bytes)) throw new DocumentProcessingError('This file is not a valid DOCX document.')
    try {
      validateDocxArchiveSize(bytes)
      const archive = unzipSync(bytes)
      const xmlBytes = archive['word/document.xml']
      if (!xmlBytes) throw new DocumentProcessingError('DOCX file is missing its document body.')
      const xml = new TextDecoder('utf-8', { fatal: true }).decode(xmlBytes)
      const text = docxXmlToText(xml)
      return { pages: [{ page_number: null, text }], page_count: null, character_count: text.length }
    } catch (error) {
      if (error instanceof DocumentProcessingError) throw error
      throw new DocumentProcessingError('Unable to read this DOCX file.')
    }
  }

  throw new DocumentProcessingError('Only PDF, DOCX, and TXT documents are supported.')
}

async function embedChunks(texts: string[], apiKey: string): Promise<number[][]> {
  const result: number[][] = new Array(texts.length)
  for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
    const inputs = texts.slice(start, start + EMBEDDING_BATCH_SIZE)
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs }),
    })
    if (!response.ok) {
      console.error('Document embedding provider returned status:', response.status)
      throw new Error('Embedding provider request failed')
    }

    const payload = await response.json()
    if (!Array.isArray(payload.data) || payload.data.length !== inputs.length) {
      throw new Error('Embedding provider returned an incomplete response')
    }
    for (const item of payload.data as Array<{ index: number; embedding: number[] }>) {
      if (!Number.isInteger(item.index) || !Array.isArray(item.embedding) || item.embedding.length !== 1536) {
        throw new Error('Embedding provider returned invalid vectors')
      }
      result[start + item.index] = item.embedding
    }
  }
  return result
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  const prefix = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 1024)))
  return prefix.includes('%PDF-')
}

function hasZipSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
