import {
  buildChatBody,
  buildEmbeddingBody,
  describePolicyFailure,
} from './openrouter-policy.mjs'
import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_OPENROUTER_FALLBACK_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  extractUsage,
  isFallbackEligibleStatus,
  isRetryableProviderStatus,
} from './ai/policy.mjs'

export type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type OpenRouterRequest = {
  messages: OpenRouterMessage[]
  maxTokens: number
  temperature?: number
}

export type OpenRouterUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type OpenRouterChatResult = {
  content: string
  model: string
  provider: 'openrouter'
  usage: OpenRouterUsage
  fallbackUsed: boolean
}

export type OpenRouterEmbeddingResult = {
  vectors: number[][]
  model: string
  provider: 'openrouter'
  usage: OpenRouterUsage
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'OpenRouterError'
  }
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

async function fetchWithTransientRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    const response = await fetch(url, init)
    if (!response.ok && isRetryableProviderStatus(response.status)) {
      await new Promise((resolve) => setTimeout(resolve, 350))
      return await fetch(url, { ...init, signal: AbortSignal.timeout(45_000) })
    }
    return response
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 350))
    return await fetch(url, { ...init, signal: AbortSignal.timeout(45_000) })
  }
}

async function callChatModel(
  apiKey: string,
  model: string,
  request: OpenRouterRequest,
): Promise<{ content: string; usage: OpenRouterUsage }> {
  const response = await fetchWithTransientRetry(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-OpenRouter-Title': 'LegalLens',
    },
    body: JSON.stringify(buildChatBody(model, request)),
    signal: AbortSignal.timeout(45_000),
  })

  if (!response.ok) {
    const policyHint = describePolicyFailure(response.status, model)
    if (policyHint) console.error(policyHint)
    throw new OpenRouterError(`OpenRouter returned HTTP ${response.status}`, response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new OpenRouterError('OpenRouter returned invalid JSON', response.status)
  }

  if (!payload || typeof payload !== 'object') {
    throw new OpenRouterError('OpenRouter returned an invalid response', response.status)
  }

  const choices = 'choices' in payload ? payload.choices : undefined
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new OpenRouterError('OpenRouter returned no completion choices', response.status)
  }

  const message = choices[0]?.message
  const content = message && typeof message === 'object' && 'content' in message
    ? message.content
    : undefined
  if (typeof content !== 'string' || !content.trim()) {
    throw new OpenRouterError('OpenRouter returned an empty completion', response.status)
  }

  return {
    content: content.trim(),
    usage: extractUsage(payload),
  }
}

export async function generateWithOpenRouterResult(
  apiKey: string,
  request: OpenRouterRequest,
): Promise<OpenRouterChatResult> {
  const primaryModel = Deno.env.get('OPENROUTER_MODEL')?.trim() || DEFAULT_OPENROUTER_MODEL
  const configuredFallback = Deno.env.get('OPENROUTER_FALLBACK_MODEL')?.trim()
  const fallbackModel = configuredFallback || DEFAULT_OPENROUTER_FALLBACK_MODEL

  try {
    const result = await callChatModel(apiKey, primaryModel, request)
    return {
      content: result.content,
      model: primaryModel,
      provider: 'openrouter',
      usage: result.usage,
      fallbackUsed: false,
    }
  } catch (error) {
    if (error instanceof OpenRouterError && !isFallbackEligibleStatus(error.status)) {
      throw error
    }
    if (fallbackModel && fallbackModel !== primaryModel) {
      console.warn(`Primary model "${primaryModel}" failed; retrying with ZDR fallback "${fallbackModel}".`)
      const fallbackResult = await callChatModel(apiKey, fallbackModel, request)
      return {
        content: fallbackResult.content,
        model: fallbackModel,
        provider: 'openrouter',
        usage: fallbackResult.usage,
        fallbackUsed: true,
      }
    }
    throw error
  }
}

export async function generateWithOpenRouter(
  apiKey: string,
  request: OpenRouterRequest,
): Promise<string> {
  const result = await generateWithOpenRouterResult(apiKey, request)
  return result.content
}

export async function embedWithOpenRouterResult(
  apiKey: string,
  input: string | string[],
): Promise<OpenRouterEmbeddingResult> {
  const model = Deno.env.get('OPENROUTER_EMBEDDING_MODEL')?.trim()
    || DEFAULT_EMBEDDING_MODEL
  const response = await fetchWithTransientRetry('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-OpenRouter-Title': 'LegalLens',
    },
    body: JSON.stringify(buildEmbeddingBody(model, input)),
    signal: AbortSignal.timeout(45_000),
  })

  if (!response.ok) {
    const policyHint = describePolicyFailure(response.status, model)
    if (policyHint) console.error(policyHint)
    throw new OpenRouterError(`OpenRouter embeddings returned HTTP ${response.status}`, response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new OpenRouterError('OpenRouter embeddings returned invalid JSON', response.status)
  }

  const data = payload && typeof payload === 'object' && 'data' in payload
    ? payload.data
    : undefined
  if (!Array.isArray(data) || data.length !== (Array.isArray(input) ? input.length : 1)) {
    throw new OpenRouterError('OpenRouter embeddings returned an unexpected result count', response.status)
  }

  const vectors = new Array<number[]>(data.length)
  for (let position = 0; position < data.length; position += 1) {
    const item = data[position]
    const embedding = item && typeof item === 'object' && 'embedding' in item
      ? item.embedding
      : undefined
    const index = item && typeof item === 'object' && 'index' in item
      ? item.index
      : position
    if (
      typeof index !== 'number' ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= data.length ||
      !Array.isArray(embedding) ||
      embedding.length !== 1536 ||
      !embedding.every((value) => typeof value === 'number' && Number.isFinite(value))
    ) {
      throw new OpenRouterError('OpenRouter returned an embedding incompatible with the 1536-dimension index', response.status)
    }
    const vector = embedding.filter((value): value is number =>
      typeof value === 'number' && Number.isFinite(value)
    )
    if (vector.length !== embedding.length || vectors[index]) {
      throw new OpenRouterError('OpenRouter returned invalid embedding values', response.status)
    }
    vectors[index] = vector
  }

  return {
    vectors,
    model,
    provider: 'openrouter',
    usage: extractUsage(payload),
  }
}

export async function embedWithOpenRouter(
  apiKey: string,
  input: string | string[],
): Promise<number[][]> {
  const result = await embedWithOpenRouterResult(apiKey, input)
  return result.vectors
}
