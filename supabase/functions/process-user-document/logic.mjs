export const MAX_CHUNK_CHARACTERS = 3500
export const CHUNK_OVERLAP_CHARACTERS = 400
export const MAX_CHUNKS = 300
export const MAX_EXTRACTED_CHARACTERS = 900_000

export function chunkDocumentPages(pages) {
  const chunks = []
  let globalChunkIndex = 0

  for (const page of pages) {
    const text = String(page.text ?? '').replace(/\s+/g, ' ').trim()
    if (!text) continue

    let start = 0
    while (start < text.length) {
      let end = Math.min(start + MAX_CHUNK_CHARACTERS, text.length)
      if (end < text.length) {
        const breakAt = text.lastIndexOf(' ', end)
        if (breakAt > start + Math.floor(MAX_CHUNK_CHARACTERS * 0.6)) {
          end = breakAt
        }
      }

      const chunkText = text.slice(start, end).trim()
      if (chunkText) {
        chunks.push({
          chunk_index: globalChunkIndex,
          page_number: Number.isInteger(page.page_number) ? page.page_number : null,
          text: chunkText,
        })
        globalChunkIndex += 1
      }

      if (chunks.length > MAX_CHUNKS) {
        throw new Error(`This document is too long to process (maximum ${MAX_CHUNKS} text sections).`)
      }
      if (end >= text.length) break
      start = Math.max(end - CHUNK_OVERLAP_CHARACTERS, start + 1)
    }
  }

  if (chunks.length === 0) {
    throw new Error('No selectable text was found. Scanned PDFs are not supported because OCR is not enabled.')
  }

  const characterCount = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0)
  if (characterCount > MAX_EXTRACTED_CHARACTERS) {
    throw new Error('This document contains too much text to process safely.')
  }

  return chunks
}

export function decodeTextFile(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  if (text.includes('\u0000')) {
    throw new Error('Text file contains invalid binary content.')
  }
  return text
}

export function validateDocxArchiveSize(bytes, maximumBytes = 25 * 1024 * 1024) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const minimumOffset = Math.max(0, bytes.byteLength - 65_557)
  let endRecordOffset = -1

  for (let offset = bytes.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endRecordOffset = offset
      break
    }
  }

  if (endRecordOffset < 0) throw new Error('DOCX archive is malformed.')

  const entryCount = view.getUint16(endRecordOffset + 10, true)
  const directorySize = view.getUint32(endRecordOffset + 12, true)
  const directoryOffset = view.getUint32(endRecordOffset + 16, true)
  if (
    entryCount > 1000 ||
    directoryOffset + directorySize > endRecordOffset ||
    directoryOffset + directorySize > bytes.byteLength
  ) {
    throw new Error('DOCX archive is malformed or contains too many entries.')
  }

  let offset = directoryOffset
  let totalUncompressedBytes = 0
  let hasDocumentXml = false

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('DOCX archive is malformed.')
    }

    const flags = view.getUint16(offset + 8, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    const filenameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const nextOffset = offset + 46 + filenameLength + extraLength + commentLength

    if (flags & 1) throw new Error('Encrypted DOCX files are not supported.')
    if (nextOffset > directoryOffset + directorySize || nextOffset > bytes.byteLength) {
      throw new Error('DOCX archive is malformed.')
    }

    const filename = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + filenameLength))
    if (filename === 'word/document.xml') hasDocumentXml = true
    totalUncompressedBytes += uncompressedSize
    if (totalUncompressedBytes > maximumBytes) {
      throw new Error('DOCX expands beyond the safe processing limit.')
    }

    offset = nextOffset
  }

  if (!hasDocumentXml) throw new Error('DOCX archive does not contain a document body.')
}

export function docxXmlToText(xml) {
  const withParagraphBreaks = String(xml)
    .replace(/<\/w:p\s*>/gi, '\n')
    .replace(/<w:tab\b[^>]*\/>/gi, '\t')
    .replace(/<w:br\b[^>]*\/>/gi, '\n')
    .replace(/<[^>]*>/g, '')

  return withParagraphBreaks
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(parseInt(value, 16)))
    .split('\n')
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}
