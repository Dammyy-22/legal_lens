import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildGroqChatBody,
  canUseGroq,
  classifyPromptGuardOutput,
  DATA_CLASSES,
  DEFAULT_OPENROUTER_FALLBACK_MODEL,
  extractUsage,
  isFallbackEligibleStatus,
  isRetryableProviderStatus,
  sliceForPromptGuard,
} from './policy.mjs'

test('canUseGroq enforces data class and ZDR confirmation boundaries', () => {
  assert.equal(canUseGroq(DATA_CLASSES.A_PUBLIC, false), true)
  assert.equal(canUseGroq(DATA_CLASSES.A_PUBLIC, true), true)

  assert.equal(canUseGroq(DATA_CLASSES.B_PRIVATE_DOC, false), false)
  assert.equal(canUseGroq(DATA_CLASSES.B_PRIVATE_DOC, true), true)

  assert.equal(canUseGroq(DATA_CLASSES.C_USER_PII, false), false)
  assert.equal(canUseGroq(DATA_CLASSES.C_USER_PII, true), true)

  assert.equal(canUseGroq(DATA_CLASSES.D_SECRET, false), false)
  assert.equal(canUseGroq(DATA_CLASSES.D_SECRET, true), false)
  assert.equal(canUseGroq('unknown_class', true), false)
})

test('default OpenRouter fallback points to non-Azure multi-host ZDR model', () => {
  assert.equal(DEFAULT_OPENROUTER_FALLBACK_MODEL, 'anthropic/claude-haiku-5.5')
})

test('status helpers distinguish retryable and fallback-eligible codes', () => {
  for (const status of [408, 429, 500, 502, 503, 504]) {
    assert.equal(isRetryableProviderStatus(status), true)
    assert.equal(isFallbackEligibleStatus(status), true)
  }
  assert.equal(isRetryableProviderStatus(404), false)
  assert.equal(isFallbackEligibleStatus(404), true)

  for (const status of [400, 401, 403, 422, undefined]) {
    assert.equal(isRetryableProviderStatus(status), false)
    assert.equal(isFallbackEligibleStatus(status), false)
  }
})

test('extractUsage parses valid, partial, negative, and invalid payloads safely', () => {
  assert.deepEqual(
    extractUsage({ usage: { prompt_tokens: 120, completion_tokens: 45, total_tokens: 165 } }),
    { promptTokens: 120, completionTokens: 45, totalTokens: 165 },
  )
  assert.deepEqual(
    extractUsage({ usage: { prompt_tokens: 50, completion_tokens: 25 } }),
    { promptTokens: 50, completionTokens: 25, totalTokens: 75 },
  )
  assert.deepEqual(
    extractUsage({ usage: { prompt_tokens: -10, completion_tokens: 12.9, total_tokens: 'bad' } }),
    { promptTokens: 0, completionTokens: 12, totalTokens: 12 },
  )
  assert.deepEqual(extractUsage(null), { promptTokens: 0, completionTokens: 0, totalTokens: 0 })
})

test('sliceForPromptGuard slices long input within bounded windows', () => {
  assert.deepEqual(sliceForPromptGuard('   '), [])
  assert.deepEqual(sliceForPromptGuard(null), [])
  const longText = 'A'.repeat(2000)
  const slices = sliceForPromptGuard(longText, 800, 2)
  assert.equal(slices.length, 2)
  assert.equal(slices[0].length, 800)
  assert.equal(slices[1].length, 800)
})

test('classifyPromptGuardOutput flags injection/jailbreak labels and permits benign/unknown', () => {
  assert.equal(classifyPromptGuardOutput('INJECTION').blocked, true)
  assert.equal(classifyPromptGuardOutput('malicious jailbreak attempt').blocked, true)
  assert.equal(classifyPromptGuardOutput('BENIGN').blocked, false)
  assert.equal(classifyPromptGuardOutput('SAFE').blocked, false)
  assert.equal(classifyPromptGuardOutput('ambiguous output').blocked, false)
})

test('buildGroqChatBody formats request fields consistently', () => {
  const withoutTemp = buildGroqChatBody('openai/gpt-oss-20b', {
    messages: [{ role: 'user', content: 'hi' }],
    maxTokens: 100,
  })
  assert.deepEqual(withoutTemp, {
    model: 'openai/gpt-oss-20b',
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 100,
  })

  const withZeroTemp = buildGroqChatBody('openai/gpt-oss-20b', {
    messages: [{ role: 'user', content: 'hi' }],
    maxTokens: 64,
    temperature: 0,
  })
  assert.equal(withZeroTemp.temperature, 0)
})
