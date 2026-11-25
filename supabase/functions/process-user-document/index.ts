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
import { embedWithOpenRouterResult } from '../_shared/openrouter.ts'
import { checkConsent, CONSENT_PURPOSES } from '../_shared/consent.mjs'
import { recordAiUsage } from '../_shared/ai/providers.ts'
import { buildCorsHeaders } from '../_shared/cors.mjs'
import {
  enforceRateLimit,
  rateLimitHeaders,
  readBoundedJson,
} from '../_shared/rate-limit.mjs'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_PDF_PAGES = 200
const MAX_OCR_PAGES = 10
const MIN_PAGE_TEXT_CHARACTERS = 40
const EMBEDDING_BATCH_SIZE = 32
const PROCESS_RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>()
const PROCESS_RATE_LIMIT = { maxRequests: 10, windowSeconds: 60 }

interface ExtractedDocumentText {
  pages: Array<{ page_number: number | null; text: string }>
  page_count: number | null
  character_count: number
}

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
  const corsHeaders = buildCorsHeaders(request, 'POST, OPTIONS')
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !openRouterKey) {
    console.error('Document processing environment is incomplete')
    return jsonResponse({ error: 'Document processing is not configured' }, 503, corsHeaders)
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization) return jsonResponse({ error: 'Missing Authorization header' }, 401, corsHeaders)

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const {
    data: { user },
    error: authError,
  } = await caller.auth.getUser()
  if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders)

  const consent = await checkConsent(caller, CONSENT_PURPOSES.privateDocuments)
  if (!consent.ok) return jsonResponse(consent.body, consent.status, corsHeaders)

  const rateLimit = await enforceRateLimit(
    caller,
    user.id,
    'document_process',
    PROCESS_RATE_LIMIT,
    PROCESS_RATE_BUCKETS,
  )
  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: 'Too many document processing requests. Please wait a minute before trying again.' },
      429,
      corsHeaders,
      rateLimitHeaders(rateLimit),
    )
  }

  const parsedBody = await readBoundedJson(request, 10_000)
  if (!parsedBody.ok) {
    return jsonResponse({ error: parsedBody.error }, parsedBody.status, corsHeaders)
  }
  const body = parsedBody.data as { document_id?: unknown }

  if (typeof body.document_id !== 'string' || !isUuid(body.document_id)) {
    return jsonResponse({ error: 'A valid document_id is required' }, 400, corsHeaders)
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
    if (!document) return jsonResponse({ error: 'Document not found' }, 404, corsHeaders)
    if (document.processing_status === 'ready') {
      return jsonResponse({ document_id: document.id, status: 'ready' }, 200, corsHeaders)
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
      return jsonResponse({ error: 'Document is already being processed' }, 409, corsHeaders)
    }
    claimedDocument = document

    const expectedExt = extensionForMime(document.mime_type)
    const expectedPath = expectedExt ? `${user.id}/${document.id}.${expectedExt}` : null
    if (
      document.owner_id !== user.id ||
      document.file_size_bytes < 1 ||
      document.file_size_bytes > MAX_FILE_BYTES ||
      !expectedPath ||
      document.storage_path !== expectedPath
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

    let extracted = await extractDocumentText(bytes, document.mime_type)
    if (document.mime_type === 'application/pdf') {
      extracted = await recognizeScannedPdfPages(bytes, extracted)
    }
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

    const embeddings: number[][] = []
    let embeddingModel = 'openai/text-embedding-3-small'
    let promptTokens = 0
    let completionTokens = 0
    let totalTokens = 0
    for (let start = 0; start < chunks.length; start += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(start, start + EMBEDDING_BATCH_SIZE).map((chunk) => chunk.text)
      const batchResult = await embedWithOpenRouterResult(openRouterKey, batch)
      embeddings.push(...batchResult.vectors)
      embeddingModel = batchResult.model
      promptTokens += batchResult.usage.promptTokens
      completionTokens += batchResult.usage.completionTokens
      totalTokens += batchResult.usage.totalTokens
    }

    await recordAiUsage(caller, {
      feature: 'process_user_document',
      provider: 'openrouter',
      model: embeddingModel,
      promptTokens,
      completionTokens,
      totalTokens,
      status: 'ok',
    })

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
    }, 200, corsHeaders)
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
      return jsonResponse({ error: message }, status, corsHeaders)
    }

    return jsonResponse({ error: 'Could not process document' }, 502, corsHeaders)
  }
})

async function extractDocumentText(
  bytes: Uint8Array,
  mimeType: string,
): Promise<ExtractedDocumentText> {
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
      const archive = unzipSync(bytes, {
        filter: (file) => file.name === 'word/document.xml' && (file.originalSize ?? 0) <= MAX_EXTRACTED_CHARACTERS * 4,
      })
      const xmlBytes = archive['word/document.xml']
      if (!xmlBytes) throw new DocumentProcessingError('DOCX file is missing its document body.')
      if (xmlBytes.byteLength > MAX_EXTRACTED_CHARACTERS * 4) {
        throw new DocumentProcessingError('DOCX expands beyond the safe processing limit.')
      }
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

async function recognizeScannedPdfPages(
  bytes: Uint8Array,
  extracted: ExtractedDocumentText,
): Promise<ExtractedDocumentText> {
  const pageNumbers: number[] = []
  for (const page of extracted.pages) {
    if (
      page.page_number !== null &&
      page.text.trim().length < MIN_PAGE_TEXT_CHARACTERS
    ) {
      pageNumbers.push(page.page_number)
    }
  }
  if (pageNumbers.length === 0) return extracted
  if (pageNumbers.length > MAX_OCR_PAGES) {
    throw new DocumentProcessingError(
      `OCR is limited to ${MAX_OCR_PAGES} scanned pages per document.`, 413
    )
  }

  const gatewayUrl = Deno.env.get('UNLIMITED_OCR_GATEWAY_URL')
  const gatewayKey = Deno.env.get('UNLIMITED_OCR_GATEWAY_KEY')
  if (!gatewayUrl || !gatewayKey) {
    throw new DocumentProcessingError('Scanned PDF OCR is not configured for this project.', 503)
  }

  let gatewayBase: URL
  try {
    gatewayBase = new URL(gatewayUrl)
  } catch {
    throw new DocumentProcessingError('Scanned PDF OCR gateway configuration is invalid.', 503)
  }
  if (
    (gatewayBase.protocol !== 'https:' &&
      !['localhost', '127.0.0.1'].includes(gatewayBase.hostname)) ||
    gatewayBase.username ||
    gatewayBase.password
  ) {
    throw new DocumentProcessingError('Scanned PDF OCR gateway must use HTTPS.', 503)
  }

  let response: Response
  try {
    const url = new URL('/v1/ocr/pdf', gatewayBase)
    url.searchParams.set('pages', pageNumbers.join(','))
    const requestBytes = new Uint8Array(bytes.byteLength)
    requestBytes.set(bytes)
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gatewayKey}`,
        'Content-Type': 'application/pdf',
      },
      body: requestBytes.buffer,
      signal: AbortSignal.timeout(300_000),
    })
  } catch (error) {
    console.error('Unlimited-OCR gateway request failed:', error)
    throw new DocumentProcessingError('Scanned PDF OCR is temporarily unavailable.', 502)
  }

  if (!response.ok) {
    console.error('Unlimited-OCR gateway returned status:', response.status)
    throw new DocumentProcessingError(
      response.status === 413
        ? 'A scanned page exceeds the OCR processing limits.'
        : 'Scanned PDF OCR is temporarily unavailable.',
      response.status === 413 ? 422 : 502,
    )
  }

  let result: { pages?: unknown }
  try {
    result = await response.json()
  } catch {
    throw new DocumentProcessingError('Unlimited-OCR gateway returned an invalid response.', 502)
  }
  if (!Array.isArray(result.pages)) {
    throw new DocumentProcessingError('Unlimited-OCR gateway returned an invalid response.', 502)
  }

  const recognizedPages = new Map<number, string>()
  for (const page of result.pages) {
    if (
      !page ||
      typeof page !== 'object' ||
      !('page_number' in page) ||
      !('text' in page) ||
      typeof page.page_number !== 'number' ||
      !Number.isInteger(page.page_number) ||
      !pageNumbers.includes(page.page_number) ||
      typeof page.text !== 'string' ||
      recognizedPages.has(page.page_number)
    ) {
      throw new DocumentProcessingError('Unlimited-OCR gateway returned invalid page data.', 502)
    }
    recognizedPages.set(page.page_number, page.text)
  }
  if (recognizedPages.size !== pageNumbers.length) {
    throw new DocumentProcessingError('Unlimited-OCR gateway returned an incomplete response.', 502)
  }

  const pages = extracted.pages.map((page) => ({
    ...page,
    text: page.page_number !== null && recognizedPages.has(page.page_number)
      ? recognizedPages.get(page.page_number) ?? page.text
      : page.text,
  }))
  const characterCount = pages.reduce((sum, page) => sum + page.text.length, 0)
  if (characterCount > MAX_EXTRACTED_CHARACTERS) {
    throw new DocumentProcessingError('This PDF contains too much text to process safely.')
  }
  return { ...extracted, pages, character_count: characterCount }
}

function extensionForMime(mimeType: string): string | null {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  if (mimeType === 'text/plain') return 'txt'
  return null
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  const prefix = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 1024)))
  return prefix.includes('%PDF-')
}

function hasZipSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice())
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
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
