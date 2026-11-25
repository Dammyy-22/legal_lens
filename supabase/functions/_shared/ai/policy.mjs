// Pure-JS AI provider governance policy, routing defaults, and usage helpers.
// Kept free of Deno APIs so `node --test` can verify routing and privacy invariants.

export const DATA_CLASSES = Object.freeze({
  A_PUBLIC: 'class_a_public',
  B_PRIVATE_DOC: 'class_b_private_doc',
  C_USER_PII: 'class_c_user_pii',
  D_SECRET: 'class_d_secret',
})

export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4.1-mini'
export const DEFAULT_OPENROUTER_FALLBACK_MODEL = 'anthropic/claude-haiku-5.5'
export const DEFAULT_EMBEDDING_MODEL = 'openai/text-embedding-3-small'

export const DEFAULT_GROQ_GUARD_MODEL = 'meta-llama/llama-prompt-guard-2-86m'
export const DEFAULT_GROQ_FAST_MODEL = 'openai/gpt-oss-20b'
export const DEFAULT_GROQ_CLASS_A_FALLBACK = 'openai/gpt-oss-120b'

export function canUseGroq(dataClass, groqZdrConfirmed = false) {
  if (dataClass === DATA_CLASSES.D_SECRET) return false
  if (dataClass === DATA_CLASSES.A_PUBLIC) return true
  if (dataClass === DATA_CLASSES.B_PRIVATE_DOC || dataClass === DATA_CLASSES.C_USER_PII) {
    return Boolean(groqZdrConfirmed)
  }
  return false
}

export function isRetryableProviderStatus(status) {
  return typeof status === 'number' && (status === 408 || status === 429 || status >= 500)
}

export function isFallbackEligibleStatus(status) {
  return isRetryableProviderStatus(status) || status === 404
}

function normalizeNonNegativeInt(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return Math.floor(value)
}

export function extractUsage(payload) {
  const usage = payload && typeof payload === 'object' && 'usage' in payload
    ? payload.usage
    : null
  if (!usage || typeof usage !== 'object') {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  }

  const promptTokens = normalizeNonNegativeInt(usage.prompt_tokens) ?? 0
  const completionTokens = normalizeNonNegativeInt(usage.completion_tokens) ?? 0
  const parsedTotal = normalizeNonNegativeInt(usage.total_tokens)
  const totalTokens = parsedTotal !== null
    ? parsedTotal
    : promptTokens + completionTokens

  return { promptTokens, completionTokens, totalTokens }
}

export function sliceForPromptGuard(text, maxChars = 1400, maxSlices = 4) {
  if (typeof text !== 'string') return []
  const trimmed = text.trim()
  if (!trimmed || maxChars < 1 || maxSlices < 1) return []

  const slices = []
  for (let i = 0; i < trimmed.length && slices.length < maxSlices; i += maxChars) {
    const chunk = trimmed.slice(i, i + maxChars).trim()
    if (chunk) slices.push(chunk)
  }
  return slices
}

export function classifyPromptGuardOutput(content) {
  const raw = typeof content === 'string' ? content.trim() : ''
  const upper = raw.toUpperCase()
  if (/\b(INJECTION|JAILBREAK|MALICIOUS)\b/.test(upper)) {
    return { blocked: true, label: raw || 'INJECTION' }
  }
  if (/\b(BENIGN|SAFE)\b/.test(upper)) {
    return { blocked: false, label: raw || 'BENIGN' }
  }
  return { blocked: false, label: raw || 'UNKNOWN' }
}

export function buildGroqChatBody(model, request) {
  return {
    model,
    messages: request.messages,
    max_tokens: request.maxTokens,
    ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
  }
}
