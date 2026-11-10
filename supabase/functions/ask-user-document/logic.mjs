export function extractCitationIds(answerText) {
  const matches = [...String(answerText ?? '').matchAll(/\[\[cite:([a-zA-Z0-9-]+)\]\]/g)]
  return [...new Set(matches.map((match) => match[1]))]
}

export function selectValidCitationIds(citedChunkIds, retrievedIds) {
  const retrieved = new Set(Array.isArray(retrievedIds) ? retrievedIds.filter((id) => typeof id === 'string') : [])
  return [...new Set((Array.isArray(citedChunkIds) ? citedChunkIds : []).filter((id) => retrieved.has(id)))]
}

export function validateDocumentAnswer(answer, citedChunkIds, retrievedIds) {
  const normalizedAnswer = typeof answer === 'string' ? answer.trim() : ''
  const validCitations = selectValidCitationIds(citedChunkIds, retrievedIds)
  if (!normalizedAnswer || validCitations.length === 0) {
    return {
      answer: "I couldn't verify an answer using citations to the passages retrieved from this document. Please rephrase your question or consult a qualified lawyer.",
      citedChunkIds: [],
      uncertain: true,
    }
  }
  return { answer: normalizedAnswer, citedChunkIds: validCitations, uncertain: false }
}

export function buildDocumentSourceExtract(chunks) {
  const safeChunks = Array.isArray(chunks)
    ? chunks.filter((chunk) => chunk && typeof chunk.id === 'string' && typeof chunk.text === 'string').slice(0, 3)
    : []

  if (safeChunks.length === 0) {
    return {
      answer: "I couldn't find a passage in this document that adequately answers your question. Check that you selected the right document or consult a qualified lawyer.",
      citedChunkIds: [],
    }
  }

  const excerpts = safeChunks.map((chunk) => {
    const text = chunk.text.trim()
    const excerpt = text.length > 700 ? `${text.slice(0, 697).trimEnd()}…` : text
    const location = documentSourceLabel(chunk.page_number, chunk.chunk_index)
    return `“${excerpt}”\n— ${location}`
  })

  return {
    answer:
      "AI analysis is unavailable. These are direct excerpts from the passages most closely matching your question, without interpretation:\n\n" +
      excerpts.join('\n\n'),
    citedChunkIds: safeChunks.map((chunk) => chunk.id),
  }
}

export function documentSourceLabel(pageNumber, chunkIndex) {
  const safeChunkIndex = Number.isInteger(chunkIndex) ? chunkIndex : 0
  return Number.isInteger(pageNumber) && pageNumber > 0
    ? `Page ${pageNumber}`
    : `Text section ${safeChunkIndex + 1}`
}
