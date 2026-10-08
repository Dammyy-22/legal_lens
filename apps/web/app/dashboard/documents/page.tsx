'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FileText, LoaderCircle, MessageCircleQuestion, Trash2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { askAboutUserDocument, type UserDocumentAnswer } from '@/lib/api-client'

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const ACCEPTED_TYPES = {
  pdf: { mime: 'application/pdf', label: 'PDF' },
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'DOCX',
  },
  txt: { mime: 'text/plain', label: 'TXT' },
} as const

interface UserDocument {
  id: string
  original_filename: string
  mime_type: string
  file_size_bytes: number
  processing_status: 'uploaded' | 'processing' | 'ready' | 'failed'
  processing_error: string | null
  page_count: number | null
  created_at: string
  storage_path: string
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<UserDocument[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [providerConsent, setProviderConsent] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<UserDocumentAnswer | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [asking, setAsking] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  )

  useEffect(() => {
    void loadDocuments()
  }, [])

  async function loadDocuments() {
    setLoading(true)
    const supabase = createClient()
    const { data, error: queryError } = await supabase
      .from('user_documents')
      .select('id, original_filename, mime_type, file_size_bytes, processing_status, processing_error, page_count, created_at, storage_path')
      .order('created_at', { ascending: false })

    if (queryError) {
      setError('Unable to load your documents. Please refresh and try again.')
      setLoading(false)
      return
    }

    const rows = (data ?? []) as UserDocument[]
    setDocuments(rows)
    setSelectedDocumentId((current) =>
      rows.some((document) => document.id === current)
        ? current
        : rows.find((document) => document.processing_status === 'ready')?.id ?? '',
    )
    setLoading(false)
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!file) {
      setError('Choose a PDF, DOCX, or TXT file to upload.')
      return
    }
    if (!providerConsent) {
      setError('Confirm that your document text may be processed by our service providers.')
      return
    }
    if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) {
      setError('Files must be smaller than 15 MB.')
      return
    }

    const extension = file.name.split('.').pop()?.toLowerCase() as keyof typeof ACCEPTED_TYPES | undefined
    const typeInfo = extension ? ACCEPTED_TYPES[extension] : undefined
    if (!typeInfo || (file.type && file.type !== typeInfo.mime)) {
      setError('Only PDF, DOCX, and plain-text TXT files are supported.')
      return
    }

    setUploading(true)
    const supabase = createClient()
    const { data: reservation, error: reservationError } = await supabase.functions.invoke(
      'create-user-document-upload',
      {
        body: {
          filename: file.name,
          mime_type: typeInfo.mime,
          file_size_bytes: file.size,
        },
      },
    )
    if (reservationError || !reservation) {
      const response = reservationError?.context instanceof Response
        ? await reservationError.context.json().catch(() => ({}))
        : {}
      setError(response.error || reservationError?.message || 'Could not prepare a secure upload.')
      setUploading(false)
      return
    }

    const { error: uploadError } = await supabase.storage
      .from('user-documents')
      .uploadToSignedUrl(reservation.storage_path, reservation.token, file, {
        contentType: typeInfo.mime,
      })

    if (uploadError) {
      const { error: objectCleanupError } = await supabase.storage
        .from('user-documents')
        .remove([reservation.storage_path])
      if (objectCleanupError) console.error('Could not clean up a failed signed upload:', objectCleanupError)
      const { error: reservationCleanupError } = await supabase
        .from('user_documents')
        .delete()
        .eq('id', reservation.document_id)
      if (reservationCleanupError) console.error('Could not release failed upload reservation:', reservationCleanupError)
      setError('The file could not be uploaded. Please try again.')
      setUploading(false)
      return
    }

    setSelectedDocumentId(reservation.document_id)
    setFile(null)
    if (fileInput.current) fileInput.current.value = ''

    const { error: processingError } = await supabase.functions.invoke('process-user-document', {
      body: { document_id: reservation.document_id },
    })
    if (processingError) {
      const response = processingError.context instanceof Response
        ? await processingError.context.json().catch(() => ({}))
        : {}
      setError(response.error || 'Upload saved, but document processing failed. You can retry from the document list.')
    }

    await loadDocuments()
    setUploading(false)
  }

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedDocument || question.trim().length < 3) return

    setAsking(true)
    setError('')
    setAnswer(null)
    try {
      const result = await askAboutUserDocument(selectedDocument.id, question.trim())
      setAnswer(result)
      setQuestion('')
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : 'Unable to ask about this document.')
    } finally {
      setAsking(false)
    }
  }

  async function handleRetry(documentId: string) {
    setError('')
    const supabase = createClient()
    const { error: processingError } = await supabase.functions.invoke('process-user-document', {
      body: { document_id: documentId },
    })
    if (processingError) {
      setError(processingError.message || 'Unable to retry document processing.')
    }
    await loadDocuments()
  }

  async function handleDelete(document: UserDocument) {
    if (!window.confirm(`Permanently delete "${document.original_filename}" and its Q&A history?`)) return

    setDeleting(document.id)
    setError('')
    const supabase = createClient()
    const { error: storageError } = await supabase.storage
      .from('user-documents')
      .remove([document.storage_path])
    if (storageError) {
      setError('Could not delete the stored file. The document record was kept.')
      setDeleting(null)
      return
    }

    const { error: deleteError } = await supabase
      .from('user_documents')
      .delete()
      .eq('id', document.id)
    if (deleteError) {
      setError('The stored file was removed, but its document record could not be deleted.')
      setDeleting(null)
      return
    }

    setDocuments((current) => current.filter((item) => item.id !== document.id))
    if (selectedDocumentId === document.id) {
      setSelectedDocumentId('')
      setAnswer(null)
    }
    setDeleting(null)
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 md:py-14">
      <div className="flex items-center gap-3 mb-3">
        <FileText size={26} className="text-brass-600" />
        <p className="font-mono text-xs uppercase tracking-widest text-brass-600">Private workspace</p>
      </div>
      <h1 className="font-display text-4xl text-ink mb-3">My documents</h1>
      <p className="text-ink-400 leading-relaxed mb-8 max-w-3xl">
        Upload a document to ask questions about its contents. This provides information
        from the document, not legal advice.
      </p>

      <div className="mb-8 rounded-lg border border-brass-600/20 bg-white p-4 text-sm text-ink-400">
        Your files are private to your account. Text is extracted from selectable
        text; scanned or image-only PDFs are not supported. To answer questions,
        relevant excerpts and your prompt are processed by OpenAI and Anthropic.
        Maximum file size: 15 MB. Delete a document to remove its stored file and
        associated Q&amp;A.
      </div>

      {error && (
        <div role="alert" className="mb-6 p-4 bg-seal/5 border border-seal/25 text-seal rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleUpload} className="mb-10 bg-white border border-ink-100 rounded-lg p-5 space-y-4">
        <label htmlFor="user-document-file" className="block text-sm font-medium text-ink">
          Choose a PDF, DOCX, or TXT file
        </label>
        <input
          ref={fileInput}
          id="user-document-file"
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          disabled={uploading}
          className="block w-full text-sm text-ink-400 file:mr-4 file:rounded-lg file:border-0 file:bg-paper file:px-4 file:py-2 file:text-ink"
        />
        <label className="flex items-start gap-3 text-sm text-ink-400">
          <input
            type="checkbox"
            checked={providerConsent}
            onChange={(event) => setProviderConsent(event.target.checked)}
            disabled={uploading}
            className="mt-1"
          />
          <span>
            I agree that relevant document text and my questions may be processed
            by OpenAI and Anthropic to provide answers.
          </span>
        </label>
        <button
          type="submit"
          disabled={uploading || !file || !providerConsent}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-ink text-paper font-medium disabled:opacity-40"
        >
          {uploading ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? 'Uploading and indexing…' : 'Upload and process'}
        </button>
      </form>

      <section aria-labelledby="documents-heading" className="mb-10">
        <h2 id="documents-heading" className="font-display text-2xl text-ink mb-4">Your files</h2>
        {loading && <p className="text-sm text-ink-400">Loading documents…</p>}
        {!loading && !error && documents.length === 0 && (
          <p className="p-5 rounded-lg border border-ink-100 bg-white text-sm text-ink-400">
            No documents uploaded yet.
          </p>
        )}
        <ul className="space-y-3">
          {documents.map((document) => (
            <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-100 bg-white p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{document.original_filename}</p>
                <p className="mt-1 text-xs text-ink-400">
                  {(document.file_size_bytes / (1024 * 1024)).toFixed(1)} MB
                  {document.page_count ? ` · ${document.page_count} pages` : ''}
                  {' · '}
                  {document.processing_status === 'ready' ? 'Ready for questions' : document.processing_status}
                </p>
                {document.processing_error && (
                  <p className="mt-2 text-xs text-seal">{document.processing_error}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {document.processing_status === 'ready' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDocumentId(document.id)
                      setAnswer(null)
                    }}
                    aria-pressed={selectedDocumentId === document.id}
                    className={`rounded-lg px-3 py-2 text-sm ${selectedDocumentId === document.id ? 'bg-ink text-paper' : 'border border-ink-100 text-ink'}`}
                  >
                    Ask
                  </button>
                )}
                {(document.processing_status === 'uploaded' || document.processing_status === 'failed') && (
                  <button
                    type="button"
                    onClick={() => void handleRetry(document.id)}
                    className="rounded-lg border border-ink-100 px-3 py-2 text-sm text-ink"
                  >
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleDelete(document)}
                  disabled={deleting === document.id}
                  aria-label={`Delete ${document.original_filename}`}
                  className="rounded-lg p-2 text-seal hover:bg-seal/5 disabled:opacity-50"
                >
                  {deleting === document.id ? <LoaderCircle size={17} className="animate-spin" /> : <Trash2 size={17} />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {selectedDocument && (
        <section aria-labelledby="document-question-heading">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircleQuestion size={20} className="text-brass-600" />
            <h2 id="document-question-heading" className="font-display text-2xl text-ink">
              Ask about {selectedDocument.original_filename}
            </h2>
          </div>
          <form onSubmit={handleAsk} className="rounded-lg border border-ink-100 bg-white p-4">
            <label htmlFor="document-question" className="sr-only">Question about this document</label>
            <textarea
              id="document-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Ask what this document says about a topic, clause, date, or obligation."
              className="w-full resize-y text-ink leading-relaxed placeholder:text-ink-400 focus:outline-none"
            />
            <div className="flex items-center justify-between gap-4 border-t border-ink-100 pt-3">
              <span className="text-xs text-ink-400">{question.length}/2000</span>
              <button
                type="submit"
                disabled={asking || question.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 font-medium text-paper disabled:opacity-40"
              >
                {asking ? <LoaderCircle size={16} className="animate-spin" /> : <MessageCircleQuestion size={16} />}
                {asking ? 'Checking document' : 'Ask about document'}
              </button>
            </div>
          </form>

          {answer && (
            <article className="mt-6 rounded-lg border border-ink-100 bg-white p-6">
              <p className="whitespace-pre-line leading-relaxed text-ink">{answer.answer}</p>
              {answer.uncertain && (
                <p className="mt-4 text-sm text-ink-400">
                  This answer is uncertain because no source passage could be attached.
                </p>
              )}
              {answer.citations.length > 0 && (
                <div className="mt-5 border-t border-ink-100 pt-4">
                  <p className="mb-2 font-mono text-xs uppercase tracking-widest text-brass-600">
                    Passages used
                  </p>
                  <ul className="space-y-1 text-sm text-ink-400">
                    {answer.citations.map((citation) => (
                      <li key={citation.chunk_id}>{citation.label}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-5 text-xs text-ink-400">
                This response explains the uploaded text only. It is not legal advice
                and may not reflect the document&apos;s legal effect.
              </p>
            </article>
          )}
        </section>
      )}
    </div>
  )
}
