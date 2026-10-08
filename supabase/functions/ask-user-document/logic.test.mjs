import test from 'node:test'
import assert from 'node:assert/strict'

import {
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
