'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  CalendarDays,
  FileSearch,
  FileText,
  LoaderCircle,
  MessageCircleQuestion,
  Scale,
  Trash2,
  Upload,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { askAboutUserDocument, type UserDocumentAnswer } from '@/lib/api-client'
import { CONSENT_PURPOSES, ensureConsent, hasCurrentConsent } from '@/lib/consent'
import { motion, useReducedMotion } from 'motion/react'
import { CountUp } from '@/components/motion/CountUp'

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

const DOCUMENT_REVIEW_PROMPTS = [
  {
    label: 'Summarize key terms',
    description: 'A neutral overview of relevant retrieved passages.',
    Icon: FileSearch,
    question:
      'Using only the retrieved passages from this uploaded document, give a concise, neutral summary of the key terms they contain. Group related points by topic, cite every factual statement, and say that these passages may not represent the entire document.',
  },
  {
    label: 'Find dates and deadlines',
    description: 'Surface dates and notice periods stated in the text.',
    Icon: CalendarDays,
    question:
      'Which dates, deadlines, notice periods, renewal periods, or other time-sensitive actions are expressly stated in the retrieved passages? Cite each item. Do not calculate or infer dates. If none appear in these passages, say so without implying they are absent from the entire document.',
  },
  {
    label: 'Review payment terms',
    description: 'Locate amounts, fees, deposits and payment timing.',
    Icon: FileText,
    question:
      'What payment amounts, fees, deposits, payment timing, or other financial obligations are expressly described in the retrieved passages? Cite each item, distinguish exact text from anything not stated, and do not infer terms from outside the document.',
  },
  {
    label: 'Prepare questions for a lawyer',
    description: 'Turn unclear wording into questions to discuss.',
    Icon: Scale,
    question:
      'Based only on the retrieved passages, list specific wording or terms the reader may want to clarify with a qualified lawyer. Cite each item. Do not assess legality, identify a breach, or suggest that a term is missing from the entire document.',
  },
] as const

export default function DocumentsPage() {
  const reduceMotion = useReducedMotion()
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
  const [dragging, setDragging] = useState(false)
  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  )

  useEffect(() => {
    void loadDocuments()
    let active = true
    hasCurrentConsent(CONSENT_PURPOSES.privateDocuments).then((current) => {
      if (active && current) setProviderConsent(true)
    })
    return () => {
      active = false
    }
  }, [])

  async function loadDocuments() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error: queryError } = await supabase
        .from('user_documents')
        .select('id, original_filename, mime_type, file_size_bytes, processing_status, processing_error, page_count, created_at, storage_path')
        .order('created_at', { ascending: false })

      if (queryError) throw queryError

      const rows = (data ?? []) as UserDocument[]
      setDocuments(rows)
      setSelectedDocumentId((current) =>
        rows.some((document) => document.id === current)
          ? current
          : rows.find((document) => document.processing_status === 'ready')?.id ?? '',
      )
    } catch (error) {
      console.error('Could not load user documents:', error)
      setError('Unable to load your documents. Please refresh and try again.')
    } finally {
      setLoading(false)
    }
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
    let supabase: ReturnType<typeof createClient> | null = null
    let reservation: {
      document_id: string
      storage_path: string
      token: string
    } | null = null
    let uploadSucceeded = false

    try {
      supabase = createClient()
      await ensureConsent(CONSENT_PURPOSES.privateDocuments)
      const { data, error: reservationError } = await supabase.functions.invoke(
        'create-user-document-upload',
        {
          body: {
            filename: file.name,
            mime_type: typeInfo.mime,
            file_size_bytes: file.size,
          },
        },
      )
      if (reservationError) {
        throw new Error(await functionErrorMessage(reservationError, 'Could not prepare a secure upload.'))
      }
      if (
        !data ||
        typeof data.document_id !== 'string' ||
        typeof data.storage_path !== 'string' ||
        typeof data.token !== 'string'
      ) {
        throw new Error('The upload service returned an invalid reservation. Please try again.')
      }
      const uploadReservation = {
        document_id: data.document_id,
        storage_path: data.storage_path,
        token: data.token,
      }
      reservation = uploadReservation

      const { error: uploadError } = await supabase.storage
        .from('user-documents')
        .uploadToSignedUrl(uploadReservation.storage_path, uploadReservation.token, file, {
          contentType: typeInfo.mime,
        })

      if (uploadError) {
        throw new Error(`The file could not be uploaded: ${uploadError.message}`)
      }

      uploadSucceeded = true
      setSelectedDocumentId(uploadReservation.document_id)
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''

      try {
        const { error: processingError } = await supabase.functions.invoke('process-user-document', {
          body: { document_id: uploadReservation.document_id },
        })
        if (processingError) {
          throw new Error(await functionErrorMessage(
            processingError,
            'Document uploaded, but processing could not be confirmed.'
          ))
        }
      } catch (processingError) {
        console.error('Document was uploaded but processing did not complete:', processingError)
        setError(
          `${processingError instanceof Error ? processingError.message : 'Document processing could not be confirmed.'} The file is saved; check its status below and retry processing if needed.`
        )
      }
    } catch (uploadFlowError) {
      console.error('Document upload failed:', uploadFlowError)
      setError(
        uploadFlowError instanceof Error
          ? uploadFlowError.message
          : 'The document could not be uploaded. Please try again.'
      )

      if (reservation && !uploadSucceeded && supabase) {
        try {
          const { error: objectCleanupError } = await supabase.storage
            .from('user-documents')
            .remove([reservation.storage_path])
          if (objectCleanupError) {
            console.error('Could not clean up a failed upload object:', objectCleanupError)
          }
        } catch (cleanupError) {
          console.error('Could not clean up a failed upload object:', cleanupError)
        }
        try {
          const { error: reservationCleanupError } = await supabase
            .from('user_documents')
            .delete()
            .eq('id', reservation.document_id)
          if (reservationCleanupError) {
            console.error('Could not release failed upload reservation:', reservationCleanupError)
          }
        } catch (cleanupError) {
          console.error('Could not release failed upload reservation:', cleanupError)
        }
      }
    } finally {
      if (uploadSucceeded) await loadDocuments()
      setUploading(false)
    }
  }

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await askDocument(selectedDocument?.id, question)
  }

  async function askDocument(documentId: string | undefined, prompt: string) {
    if (!documentId || prompt.trim().length < 3) return

    setAsking(true)
    setError('')
    setAnswer(null)
    try {
      if (providerConsent) await ensureConsent(CONSENT_PURPOSES.privateDocuments)
      const result = await askAboutUserDocument(documentId, prompt.trim())
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
    try {
      if (providerConsent) await ensureConsent(CONSENT_PURPOSES.privateDocuments)
      const supabase = createClient()
      const { error: processingError } = await supabase.functions.invoke('process-user-document', {
        body: { document_id: documentId },
      })
      if (processingError) {
        throw new Error(await functionErrorMessage(processingError, 'Unable to retry document processing.'))
      }
    } catch (error) {
      console.error('Could not retry document processing:', error)
      setError(error instanceof Error ? error.message : 'Unable to retry document processing.')
    } finally {
      await loadDocuments()
    }
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
        Your files are private to your account. Pages with little or no selectable
        text in a PDF may be sent to the configured Baidu Unlimited-OCR service for
        text extraction. Extracted text is sent to OpenRouter for indexing;
        relevant passages and your questions are sent through OpenRouter to the
        selected model provider to answer.
        Maximum file size: 15 MB. Delete a document to remove its stored file and
        associated Q&amp;A.
      </div>

      {error && (
        <div role="alert" className="mb-6 p-4 bg-seal/5 border border-seal/25 text-seal rounded-lg text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={handleUpload}
        onDragOver={(event) => {
          if (uploading) return
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          const dropped = event.dataTransfer.files?.[0]
          if (uploading || !dropped) return
          if (fileInput.current) fileInput.current.files = event.dataTransfer.files
          setFile(dropped)
        }}
        className={`mb-10 bg-white border border-dashed border-ink-100 rounded-lg p-5 space-y-4 transition-all duration-200 ${dragging ? 'dropzone-active' : ''}`}
      >
        {dragging && (
          <p role="status" className="font-mono text-xs uppercase tracking-widest text-brass-600">
            Release to select this file
          </p>
        )}
        {file && !dragging && (
          <p className="rounded-lg bg-paper px-3 py-2 text-sm text-ink workflow-step">
            Selected: <span className="font-medium">{file.name}</span>
          </p>
        )}
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
            I agree that extracted document text may be processed through OpenRouter for
            indexing and that relevant passages and my questions may be processed
            through OpenRouter to a model provider to provide answers. We ask OpenRouter to
            use only providers it lists as zero-data-retention. For PDFs with scanned
            pages, those pages may be sent to the configured Baidu Unlimited-OCR
            service for text extraction. I can withdraw this consent in Settings. (Tick this box to ask questions about or retry documents you uploaded earlier.)
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
        {!loading && documents.length > 0 && (
          <p className="mb-4 text-sm text-ink-400">
            <CountUp value={documents.length} className="font-medium text-ink" /> {documents.length === 1 ? 'file' : 'files'} ·{' '}
            <CountUp value={documents.filter((d) => d.processing_status === 'ready').length} className="font-medium text-ink" /> ready for questions
          </p>
        )}
        {loading && <p className="text-sm text-ink-400">Loading documents…</p>}
        {!loading && !error && documents.length === 0 && (
          <p className="p-5 rounded-lg border border-ink-100 bg-white text-sm text-ink-400">
            No documents uploaded yet.
          </p>
        )}
        <ul className="space-y-3">
          {documents.map((document) => (
            <motion.li
              key={document.id}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.2, 0.75, 0.25, 1] }}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-100 bg-white p-4 transition-colors hover:border-brass/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{document.original_filename}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-ink-400">
                  <span
                    aria-hidden="true"
                    className={`inline-block h-2 w-2 rounded-full ${
                      document.processing_status === 'ready'
                        ? 'bg-ink-600'
                        : document.processing_status === 'failed'
                          ? 'bg-seal'
                          : 'bg-brass status-dot-processing'
                    }`}
                  />
                  <span>
                    {(document.file_size_bytes / (1024 * 1024)).toFixed(1)} MB
                    {document.page_count ? ` · ${document.page_count} pages` : ''}
                    {' · '}
                    {document.processing_status === 'ready' ? 'Ready for questions' : document.processing_status}
                  </span>
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
            </motion.li>
          ))}
        </ul>
      </section>

      {selectedDocument && (
        <section aria-labelledby="document-question-heading">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircleQuestion size={20} className="text-brass-600" />
            <h2 id="document-question-heading" className="font-display text-2xl text-ink">
              Review {selectedDocument.original_filename}
            </h2>
          </div>
          <p className="mb-4 max-w-3xl text-sm leading-6 text-ink-400">
            Choose a topic to inspect or ask your own question. Answers use retrieved
            passages only, may not cover the whole file, and are not a legal risk
            assessment or legal advice.
          </p>
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            {DOCUMENT_REVIEW_PROMPTS.map(({ label, description, Icon, question: reviewQuestion }) => (
              <button
                key={label}
                type="button"
                disabled={asking}
                onClick={() => {
                  setQuestion(reviewQuestion)
                  void askDocument(selectedDocument.id, reviewQuestion)
                }}
                className="group flex min-h-20 items-start gap-3 rounded-lg border border-ink-100 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brass/40 hover:shadow-[0_10px_24px_rgba(20,38,30,0.07)] disabled:cursor-wait disabled:opacity-60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper text-brass-600 transition-colors group-hover:bg-ink group-hover:text-brass-400">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{label}</span>
                  <span className="mt-1 block text-xs leading-5 text-ink-400">{description}</span>
                </span>
              </button>
            ))}
          </div>
          <form onSubmit={handleAsk} className="rounded-lg border border-ink-100 bg-white p-4">
            <label htmlFor="document-question" className="mb-2 block text-sm font-medium text-ink">
              Or ask about a specific clause or topic
            </label>
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

          {asking && (
            <div role="status" aria-live="polite" className="mt-6 flex items-center gap-3 rounded-lg border border-brass/25 bg-white p-4 text-sm text-ink-400">
              <span className="flex items-end gap-1" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="ask-dot h-1.5 w-1.5 rounded-full bg-brass" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </span>
              Reading the retrieved passages…
            </div>
          )}

          {answer && (
            <motion.article
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.2, 0.75, 0.25, 1] }}
              className="mt-6 rounded-lg border border-ink-100 bg-white p-6"
            >
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
            </motion.article>
          )}
        </section>
      )}
    </div>
  )
}

async function functionErrorMessage(
  error: { message: string; context?: unknown },
  fallback: string,
): Promise<string> {
  if (error.context instanceof Response) {
    try {
      const body: unknown = await error.context.clone().json()
      if (
        body &&
        typeof body === 'object' &&
        'error' in body &&
        typeof body.error === 'string'
      ) {
        return body.error
      }
    } catch {
      return `${fallback} (HTTP ${error.context.status})`
    }
    return `${fallback} (HTTP ${error.context.status})`
  }
  return error.message || fallback
}
