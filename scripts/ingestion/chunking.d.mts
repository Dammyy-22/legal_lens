export const MAX_CHUNK_CHARS: number
export const CHUNK_OVERLAP_CHARS: number
export const EMBEDDING_BATCH_SIZE: number

export function splitTextWithOverlap(
  text: string,
  maxChars?: number,
  overlapChars?: number,
): string[]
