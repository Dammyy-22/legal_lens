export function extractCitationIds(answerText) {
  const matches = [...String(answerText ?? '').matchAll(/\[\[cite:([a-zA-Z0-9-]+)\]\]/g)]
  return [...new Set(matches.map((match) => match[1]))]
}

export function selectValidCitationIds(citedChunkIds, retrievedIds) {
  const retrieved = new Set(retrievedIds)
  return [...new Set((citedChunkIds ?? []).filter((id) => retrieved.has(id)))]
}

export function validateDocumentAnswer(answer, citedChunkIds, retrievedIds) {
  const validCitations = selectValidCitationIds(citedChunkIds, retrievedIds)
  if (!answer.trim() || validCitations.length === 0) {
    return {
      answer: "I couldn't verify an answer using citations to the passages retrieved from this document. Please rephrase your question or consult a qualified lawyer.",
      citedChunkIds: [],
      uncertain: true,
    }
  }
  return { answer: answer.trim(), citedChunkIds: validCitations, uncertain: false }
}

export function documentSourceLabel(pageNumber, chunkIndex) {
  return Number.isInteger(pageNumber) && pageNumber > 0
    ? `Page ${pageNumber}`
    : `Text section ${chunkIndex + 1}`
}
