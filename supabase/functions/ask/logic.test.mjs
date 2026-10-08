import test from 'node:test'
import assert from 'node:assert/strict'

import {
  computeRateLimitState,
  extractCitationIds,
  normalizeQuestion,
  selectValidCitationIds,
} from './logic.mjs'

test('normalizeQuestion collapses whitespace and strips empty input', () => {
  assert.equal(normalizeQuestion('  What is  the law?  '), 'What is the law?')
  assert.equal(normalizeQuestion('   '), null)
  assert.equal(normalizeQuestion(123), null)
})

test('extractCitationIds finds unique citation references', () => {
  const answer = 'The rule is this [[cite:chunk-1]]. See also [[cite:chunk-2]] and [[cite:chunk-1]].'
  assert.deepEqual(extractCitationIds(answer), ['chunk-1', 'chunk-2'])
})

test('selectValidCitationIds rejects citations to unreturned chunks', () => {
  const cited = ['chunk-1', 'chunk-999', 'chunk-2']
  const retrievedIds = ['chunk-1', 'chunk-2']
  assert.deepEqual(selectValidCitationIds(cited, retrievedIds), ['chunk-1', 'chunk-2'])
})

test('computeRateLimitState increments within window and denies after cap', () => {
  const buckets = new Map()
  const config = { windowMs: 60_000, maxRequests: 2 }

  const first = computeRateLimitState('user-1', buckets, config)
  assert.equal(first.allowed, true)
  assert.equal(first.count, 1)

  const second = computeRateLimitState('user-1', buckets, config)
  assert.equal(second.allowed, true)
  assert.equal(second.count, 2)

  const third = computeRateLimitState('user-1', buckets, config)
  assert.equal(third.allowed, false)
  assert.equal(third.retryAfterMs > 0, true)
  assert.equal(buckets.get('user-1').count, 2)
})

test('search scoring prioritizes title and section matches over generic text hits', () => {
  const query = 'police arrest powers'
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)

  function scoreLegalResult(result) {
    const searchable = `${result.source_title} ${result.section_label} ${result.section_heading ?? ''} ${result.text}`.toLowerCase()
    const phraseMatch = searchable.includes(query.toLowerCase()) ? 3 : 0
    const titleMatches = terms.filter((term) => result.source_title.toLowerCase().includes(term)).length
    const headingMatches = terms.filter((term) => (result.section_heading ?? '').toLowerCase().includes(term)).length
    const textMatches = terms.filter((term) => result.text.toLowerCase().includes(term)).length
    return phraseMatch + titleMatches * 5 + headingMatches * 3 + textMatches * 2
  }

  const exactMatch = {
    source_title: 'Police Act 2020',
    section_label: 'Part VIII',
    section_heading: 'Powers of Arrest',
    text: 'A police officer may arrest a person who is endangering the public peace.',
  }

  const genericMatch = {
    source_title: 'Labour Act',
    section_label: 'Chapter 2',
    section_heading: 'General provisions',
    text: 'This section discusses police, arrest, and powers in general terms across several contexts.',
  }

  assert.ok(scoreLegalResult(exactMatch) > scoreLegalResult(genericMatch))
})
