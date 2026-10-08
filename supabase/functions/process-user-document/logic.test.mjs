import test from 'node:test'
import assert from 'node:assert/strict'

import {
  chunkDocumentPages,
  decodeTextFile,
  docxXmlToText,
  validateDocxArchiveSize,
} from './logic.mjs'

test('chunkDocumentPages preserves page references and creates overlapping chunks', () => {
  const text = 'word '.repeat(1800)
  const chunks = chunkDocumentPages([{ page_number: 7, text }])

  assert.ok(chunks.length > 1)
  assert.ok(chunks.every((chunk) => chunk.page_number === 7))
  assert.ok(chunks.every((chunk) => chunk.text.length <= 3500))
  assert.equal(chunks[0].chunk_index, 0)
  assert.equal(chunks[1].chunk_index, 1)
  assert.ok(chunks[0].text.slice(-100).split(' ').some((word) => chunks[1].text.startsWith(word)))
})

test('chunkDocumentPages refuses documents without extractable text and excessive chunks', () => {
  assert.throws(
    () => chunkDocumentPages([{ page_number: 1, text: '' }]),
    /Scanned PDFs are not supported/
  )

  assert.throws(
    () => chunkDocumentPages([{ page_number: 1, text: 'long '.repeat(300_000) }]),
    /too long to process/
  )
})

test('decodeTextFile rejects invalid UTF-8 and binary nulls', () => {
  assert.equal(decodeTextFile(new TextEncoder().encode('A plain legal document.')), 'A plain legal document.')
  assert.throws(() => decodeTextFile(Uint8Array.from([0xff, 0xfe])), /encoded data/)
  assert.throws(() => decodeTextFile(Uint8Array.from([65, 0, 66])), /binary content/)
})

test('docxXmlToText extracts readable paragraphs and decodes XML entities', () => {
  const xml = '<w:p><w:r><w:t>Terms &amp; conditions</w:t></w:r></w:p><w:p><w:r><w:t>Right &#169;</w:t></w:r></w:p>'
  assert.equal(docxXmlToText(xml), 'Terms & conditions\nRight ©')
})

test('validateDocxArchiveSize rejects malformed archives before decompression', () => {
  assert.throws(() => validateDocxArchiveSize(new Uint8Array([1, 2, 3])), /malformed/)
})
