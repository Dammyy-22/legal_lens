import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDocumentSourceExtract,
  documentSourceLabel,
  extractCitationIds,
  selectValidCitationIds,
  validateDocumentAnswer,
} from './logic.mjs'

test('document citations are extracted uniquely and filtered to retrieved chunks', () => {
  const ids = extractCitationIds('The term appears here [[cite:chunk-1]]. Again [[cite:chunk-1]], then [[cite:chunk-2]].')
  assert.deepEqual(ids, ['chunk-1', 'chunk-2'])
  assert.deepEqual(selectValidCitationIds(ids, ['chunk-1']), ['chunk-1'])
})

test('document citation locations use PDF pages or text-section numbers', () => {
  assert.equal(documentSourceLabel(4, 3), 'Page 4')
  assert.equal(documentSourceLabel(null, 3), 'Text section 4')
  assert.equal(documentSourceLabel(null, null), 'Text section 1')
})

test('answers without a valid retrieved citation are replaced with a safe fallback', () => {
  assert.deepEqual(validateDocumentAnswer('Unsupported claim', ['missing'], ['retrieved']), {
    answer: "I couldn't verify an answer using citations to the passages retrieved from this document. Please rephrase your question or consult a qualified lawyer.",
    citedChunkIds: [],
    uncertain: true,
  })
  assert.deepEqual(validateDocumentAnswer('Supported claim', ['retrieved'], ['retrieved']), {
    answer: 'Supported claim',
    citedChunkIds: ['retrieved'],
    uncertain: false,
  })
})

test('provider fallback returns bounded direct excerpts and only retrieved citations', () => {
  const result = buildDocumentSourceExtract([
    { id: 'chunk-1', text: 'The tenancy term begins on 1 January.', page_number: 2, chunk_index: 0 },
    { id: 'chunk-2', text: 'Rent is due on the first day of each month.', page_number: null, chunk_index: 1 },
    { id: 'chunk-3', text: 'A third passage.', page_number: null, chunk_index: 2 },
    { id: 'chunk-4', text: 'This passage should not be included.', page_number: null, chunk_index: 3 },
  ])

  assert.match(result.answer, /AI analysis is unavailable/)
  assert.match(result.answer, /— Page 2/)
  assert.match(result.answer, /— Text section 2/)
  assert.doesNotMatch(result.answer, /should not be included/)
  assert.deepEqual(result.citedChunkIds, ['chunk-1', 'chunk-2', 'chunk-3'])
})
