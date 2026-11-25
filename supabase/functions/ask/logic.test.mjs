import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildSourceExtract,
  computeRateLimitState,
  extractCitationIds,
  finalizeGroundedAnswer,
  formatConversationHistory,
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

test('buildSourceExtract handles malformed inputs without crashing', () => {
  assert.deepEqual(buildSourceExtract(null, null), {
    answer: "I found verified legal text, but couldn't isolate a provision closely enough related to your wording to quote it reliably. I can't safely apply the law to your situation without a relevant passage and a working legal-analysis provider.",
    citedChunkIds: [],
  })
  assert.deepEqual(buildSourceExtract('', [{ text: 'No match here' }]), {
    answer: "I found verified legal text, but couldn't isolate a provision closely enough related to your wording to quote it reliably. I can't safely apply the law to your situation without a relevant passage and a working legal-analysis provider.",
    citedChunkIds: [],
  })
})

test('buildSourceExtract returns matching verified text and its source citation', () => {
  const chunks = [
    {
      id: 'chunk-35',
      source_title: 'Constitution of Nigeria',
      section_label: 'Chapter IV',
      text: 'Every person shall be entitled to his personal liberty. A person arrested or detained shall be informed in writing, within twenty-four hours, of the facts and grounds for his arrest or detention.',
    },
    {
      id: 'chunk-13',
      source_title: 'Constitution of Nigeria',
      section_label: 'Chapter II',
      text: 'The Government shall promote a planned and balanced economic development.',
    },
  ]

  const result = buildSourceExtract('I was arrested and was not told why', chunks)
  assert.match(result.answer, /live legal-analysis provider is unavailable/i)
  assert.match(result.answer, /person arrested or detained shall be informed in writing/)
  assert.deepEqual(result.citedChunkIds, ['chunk-35'])
})

test('buildSourceExtract does not cite chunks when it cannot isolate a relevant passage', () => {
  const result = buildSourceExtract('How do I register a company?', [{
    id: 'chunk-1',
    source_title: 'Constitution of Nigeria',
    section_label: 'Chapter IV',
    text: 'Every person shall be entitled to his personal liberty.',
  }])

  assert.deepEqual(result.citedChunkIds, [])
  assert.match(result.answer, /couldn't isolate a provision/i)
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

test('finalizeGroundedAnswer replaces uncited LLM prose with verified source extract or refusal', () => {
  const chunks = [
    {
      id: 'chunk-35',
      source_title: 'Constitution of Nigeria',
      section_label: 'Chapter IV',
      text: 'A person arrested or detained shall be informed in writing of the facts and grounds for his arrest.',
    },
  ]

  const uncited = finalizeGroundedAnswer(
    'arrested without reason',
    'Hallucinated claim with no valid citation',
    ['fake-id-999'],
    chunks,
  )
  assert.equal(uncited.uncertain, true)
  assert.equal(uncited.answerMode, 'source_extract')
  assert.doesNotMatch(uncited.answer, /Hallucinated claim/)
  assert.deepEqual(uncited.citedChunkIds, ['chunk-35'])

  const cited = finalizeGroundedAnswer(
    'arrested without reason',
    'You must be informed in writing.',
    ['chunk-35'],
    chunks,
  )
  assert.equal(cited.uncertain, false)
  assert.equal(cited.answerMode, 'generated')
  assert.deepEqual(cited.citedChunkIds, ['chunk-35'])
})

test('formatConversationHistory filters invalid turns and bounds count and characters', () => {
  const raw = [
    { role: 'system', content: 'should be ignored' },
    { role: 'user', content: 'First   question' },
    { role: 'assistant', content: 'First   answer' },
    { role: 'user', content: '   ' },
    { role: 'user', content: 'Second question' },
    { role: 'assistant', content: 'Second answer' },
  ]
  assert.deepEqual(formatConversationHistory(raw, 2, 500), [
    { role: 'user', content: 'Second question' },
    { role: 'assistant', content: 'Second answer' },
  ])

  const charCapped = formatConversationHistory(raw, 6, 45)
  assert.ok(charCapped.length >= 2)
  const totalLen = charCapped.reduce((sum, item) => sum + item.content.length, 0)
  assert.ok(totalLen <= 45)
  assert.equal(charCapped[charCapped.length - 1].content, 'Second answer')
})
