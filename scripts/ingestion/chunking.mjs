// Shared chunking and batching constants/helpers for offline legal corpus ingestion.
// Kept pure JS for Node unit testing and parity with process-user-document/logic.mjs.

export const MAX_CHUNK_CHARS = 3500
export const CHUNK_OVERLAP_CHARS = 400
export const EMBEDDING_BATCH_SIZE = 32

export function splitTextWithOverlap(
  text,
  maxChars = MAX_CHUNK_CHARS,
  overlapChars = CHUNK_OVERLAP_CHARS,
) {
  if (typeof text !== 'string') return []
  const normalized = text.trim()
  if (!normalized || maxChars < 1) return []

  const safeOverlap = Math.min(Math.max(0, Math.floor(overlapChars)), Math.max(0, maxChars - 1))
  const chunks = []
  let start = 0

  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length)
    if (end < normalized.length) {
      const breakAt = normalized.lastIndexOf(' ', end)
      if (breakAt > start + Math.floor(maxChars * 0.6)) {
        end = breakAt
      }
    }

    const piece = normalized.slice(start, end).trim()
    if (piece) chunks.push(piece)
    if (end >= normalized.length) break
    start = Math.max(end - safeOverlap, start + 1)
  }

  return chunks
}
