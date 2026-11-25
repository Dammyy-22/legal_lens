import assert from 'node:assert/strict'
import test from 'node:test'
import { splitTextWithOverlap } from './chunking.mjs'

test('splitTextWithOverlap handles empty, non-string, and short inputs', () => {
  assert.deepEqual(splitTextWithOverlap(''), [])
  assert.deepEqual(splitTextWithOverlap('   '), [])
  assert.deepEqual(splitTextWithOverlap(null), [])
  assert.deepEqual(splitTextWithOverlap('Short legal clause.'), ['Short legal clause.'])
})

test('splitTextWithOverlap splits long text on word boundaries with overlap preserved', () => {
  const words = Array.from({ length: 60 }, (_, idx) => `word${idx + 1}`).join(' ')
  const chunks = splitTextWithOverlap(words, 120, 30)

  assert.ok(chunks.length >= 3)
  for (const chunk of chunks) {
    assert.ok(chunk.length > 0 && chunk.length <= 120)
  }

  // Adjacent chunks should share trailing/leading token overlap
  const firstTail = chunks[0].split(' ').slice(-2)
  assert.ok(firstTail.some((token) => chunks[1].includes(token)))
})
