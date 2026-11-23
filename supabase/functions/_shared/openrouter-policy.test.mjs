import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildChatBody,
  buildEmbeddingBody,
  describePolicyFailure,
  PROVIDER_DATA_POLICY,
} from './openrouter-policy.mjs'

test('policy requires zero data retention and denies data collection', () => {
  assert.equal(PROVIDER_DATA_POLICY.zdr, true)
  assert.equal(PROVIDER_DATA_POLICY.data_collection, 'deny')
  assert.throws(() => {
    'use strict'
    PROVIDER_DATA_POLICY.zdr = false
  })
})

test('chat body always carries the strict provider policy', () => {
  const body = buildChatBody('openai/gpt-4.1-mini', {
    messages: [{ role: 'user', content: 'hi' }],
    maxTokens: 100,
  })
  assert.deepEqual(body.provider, { zdr: true, data_collection: 'deny' })
  assert.equal(body.model, 'openai/gpt-4.1-mini')
  assert.equal(body.max_tokens, 100)
  assert.equal('temperature' in body, false)
})

test('chat body keeps temperature when provided, including 0', () => {
  const body = buildChatBody('m', { messages: [], maxTokens: 1, temperature: 0 })
  assert.equal(body.temperature, 0)
  assert.deepEqual(body.provider, { zdr: true, data_collection: 'deny' })
})

test('embedding body always carries the strict provider policy', () => {
  const body = buildEmbeddingBody('openai/text-embedding-3-small', ['a', 'b'])
  assert.deepEqual(body.provider, { zdr: true, data_collection: 'deny' })
  assert.deepEqual(body.input, ['a', 'b'])
})

test('callers cannot weaken the policy by mutating a returned body', () => {
  const first = buildChatBody('m', { messages: [], maxTokens: 1 })
  first.provider.zdr = false
  const second = buildChatBody('m', { messages: [], maxTokens: 1 })
  assert.equal(second.provider.zdr, true)
})

test('a 404 is explained as a missing ZDR endpoint; other statuses are not', () => {
  assert.match(describePolicyFailure(404, 'x/y'), /zero-data-retention endpoint for model "x\/y"/)
  assert.equal(describePolicyFailure(429, 'x/y'), null)
  assert.equal(describePolicyFailure(500, 'x/y'), null)
})
