import { createClient } from 'npm:@supabase/supabase-js@2'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
])

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  if (Number(request.headers.get('content-length') ?? 0) > 4000) {
    return jsonResponse({ error: 'Request body is too large' }, 413)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Document upload environment is incomplete')
    return jsonResponse({ error: 'Document uploads are not configured' }, 503)
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

  let body: { filename?: unknown; mime_type?: unknown; file_size_bytes?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  if (
    typeof body.filename !== 'string' ||
    typeof body.mime_type !== 'string' ||
    !MIME_TYPES.has(body.mime_type) ||
    typeof body.file_size_bytes !== 'number' ||
    !Number.isInteger(body.file_size_bytes) ||
    body.file_size_bytes < 1 ||
    body.file_size_bytes > MAX_FILE_BYTES
  ) {
    return jsonResponse({ error: 'Invalid filename, file type, or file size' }, 400)
  }

  const extension = extensionForMime(body.mime_type)
  if (!body.filename.toLowerCase().endsWith(`.${extension}`)) {
    return jsonResponse({ error: 'Filename extension does not match the declared file type' }, 400)
  }

  const documentId = crypto.randomUUID()
  const storagePath = `${user.id}/${documentId}.${extension}`
  const safeFilename = body.filename.replace(/[\u0000-\u001f\u007f]/g, '_').slice(0, 255)
  const { error: insertError } = await caller.from('user_documents').insert({
    id: documentId,
    owner_id: user.id,
    original_filename: safeFilename,
    storage_path: storagePath,
    mime_type: body.mime_type,
    file_size_bytes: body.file_size_bytes,
    processing_status: 'uploaded',
  })
  if (insertError) {
    console.error('Could not reserve user document upload:', insertError.code)
    const status = insertError.code === '54000' ? 413 : 400
    return jsonResponse({
      error: status === 413
        ? 'Document limit reached. Delete an existing document before uploading another.'
        : 'Could not register this document upload.',
    }, status)
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: signedUpload, error: signedUploadError } = await service.storage
    .from('user-documents')
    .createSignedUploadUrl(storagePath, { upsert: false })

  if (signedUploadError || !signedUpload) {
    const { error: cleanupError } = await caller
      .from('user_documents')
      .delete()
      .eq('id', documentId)
      .eq('owner_id', user.id)
    if (cleanupError) console.error('Could not release failed upload reservation:', cleanupError)
    console.error('Could not create signed user document upload:', signedUploadError)
    return jsonResponse({ error: 'Could not prepare a secure upload' }, 502)
  }

  return jsonResponse({
    document_id: documentId,
    storage_path: storagePath,
    token: signedUpload.token,
    original_filename: safeFilename,
    mime_type: body.mime_type,
    file_size_bytes: body.file_size_bytes,
  })
})

function extensionForMime(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  return 'txt'
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
