import test from 'node:test'
import assert from 'node:assert/strict'
import { enforceRateLimit, readBoundedJson } from './rate-limit.mjs'

test('enforceRateLimit uses consume_rate_limit RPC when available', async () => {
  const mockSupabase = {
    async rpc(name, params) {
      assert.equal(name, 'consume_rate_limit')
      assert.equal(params.p_action, 'ask')
      assert.equal(params.p_max_requests, 20)
      return { data: [{ allowed: false, remaining: 0, retry_after_seconds: 42 }], error: null }
    },
  }
  const result = await enforceRateLimit(
    mockSupabase,
    'user-1',
    'ask',
    { maxRequests: 20, windowSeconds: 60 },
    new Map(),
  )
  assert.equal(result.allowed, false)
  assert.equal(result.retryAfterSeconds, 42)
  assert.equal(result.source, 'database')
})

test('enforceRateLimit falls back to bounded memory limit if RPC errors', async () => {
  const buckets = new Map()
  const brokenSupabase = {
    async rpc() {
      return { data: null, error: { code: 'PGRST202', message: 'missing function' } }
    },
  }
  const first = await enforceRateLimit(
    brokenSupabase,
    'user-1',
    'draft',
    { maxRequests: 1, windowSeconds: 60 },
    buckets,
  )
  const second = await enforceRateLimit(
    brokenSupabase,
    'user-1',
    'draft',
    { maxRequests: 1, windowSeconds: 60 },
    buckets,
  )
  assert.equal(first.allowed, true)
  assert.equal(first.source, 'memory')
  assert.equal(second.allowed, false)
  assert.ok(second.retryAfterSeconds >= 1)
})

test('readBoundedJson rejects chunked streams exceeding maxBytes without Content-Length', async () => {
  const oversized = new Request('https://example.test/ask', {
    method: 'POST',
    body: JSON.stringify({ question: 'x'.repeat(200) }),
  })
  const result = await readBoundedJson(oversized, 50)
  assert.equal(result.ok, false)
  assert.equal(result.status, 413)
})

test('readBoundedJson parses valid JSON within limit', async () => {
  const valid = new Request('https://example.test/ask', {
    method: 'POST',
    body: JSON.stringify({ question: 'hello' }),
  })
  const result = await readBoundedJson(valid, 1024)
  assert.equal(result.ok, true)
  assert.deepEqual(result.data, { question: 'hello' })
})
