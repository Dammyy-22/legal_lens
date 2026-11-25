export function extractCitationIds(answerText) {
  const matches = [...String(answerText ?? '').matchAll(/\[\[cite:([a-zA-Z0-9-]+)\]\]/g)]
  return [...new Set(matches.map((match) => match[1]))]
}

export function selectValidCitationIds(citedChunkIds, retrievedIds) {
  const retrieved = new Set(Array.isArray(retrievedIds) ? retrievedIds.filter((id) => typeof id === 'string') : [])
  return [...new Set((Array.isArray(citedChunkIds) ? citedChunkIds : []).filter((id) => retrieved.has(id)))]
}

export function detectPromptLeakage(answerText) {
  const text = String(answerText ?? '')
  return (
    /Answer only from the source passages supplied here/i.test(text) ||
    /DOCUMENT PASSAGES:/i.test(text) ||
    /CRITICAL RULES,\s*in order of priority/i.test(text) ||
    /\[\[cite:REF\]\]/i.test(text)
  )
}

export function validateDocumentAnswer(answer, citedChunkIds, retrievedIds) {
  const normalizedAnswer = typeof answer === 'string' ? answer.trim() : ''
  const validCitations = selectValidCitationIds(citedChunkIds, retrievedIds)
  if (!normalizedAnswer || validCitations.length === 0 || detectPromptLeakage(normalizedAnswer)) {
    return {
      answer: "I couldn't verify an answer using citations to the passages retrieved from this document. Please rephrase your question or consult a qualified lawyer.",
      citedChunkIds: [],
      uncertain: true,
    }
  }
  return { answer: normalizedAnswer, citedChunkIds: validCitations, uncertain: false }
}

export function documentSourceLabel(pageNumber, chunkIndex) {
  const safeChunkIndex = Number.isInteger(chunkIndex) ? chunkIndex : 0
  return Number.isInteger(pageNumber) && pageNumber > 0
    ? `Page ${pageNumber}`
    : `Text section ${safeChunkIndex + 1}`
}
