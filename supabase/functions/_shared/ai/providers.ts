import {
  generateWithOpenRouterResult,
  type OpenRouterMessage,
  type OpenRouterUsage,
} from '../openrouter.ts'
import {
  buildGroqChatBody,
  canUseGroq,
  classifyPromptGuardOutput,
  DATA_CLASSES,
  DEFAULT_GROQ_CLASS_A_FALLBACK,
  DEFAULT_GROQ_FAST_MODEL,
  DEFAULT_GROQ_GUARD_MODEL,
  extractUsage,
  sliceForPromptGuard,
} from './policy.mjs'

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_DAILY_TOKEN_BUDGET = 100_000

export type ProviderChatRequest = {
  messages: OpenRouterMessage[]
  maxTokens: number
  temperature?: number
  dataClass: string
  model?: string
}

export type ProviderChatResult = {
  content: string
  model: string
  provider: 'openrouter' | 'groq'
  usage: OpenRouterUsage
  fallbackUsed: boolean
}

export interface ModelProvider {
  readonly name: 'openrouter' | 'groq'
  generateChat(request: ProviderChatRequest): Promise<ProviderChatResult>
}

export function createOpenRouterProvider(apiKey: string): ModelProvider {
  return {
    name: 'openrouter',
    async generateChat(request: ProviderChatRequest): Promise<ProviderChatResult> {
      return await generateWithOpenRouterResult(apiKey, {
        messages: request.messages,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      })
    },
  }
}

export function createGroqProvider(
  apiKey: string,
  options: { zdrConfirmed?: boolean; model?: string; timeoutMs?: number } = {},
): ModelProvider {
  const zdrConfirmed = options.zdrConfirmed ?? false
  const defaultModel = options.model ?? DEFAULT_GROQ_FAST_MODEL
  const timeoutMs = options.timeoutMs ?? 20_000

  return {
    name: 'groq',
    async generateChat(request: ProviderChatRequest): Promise<ProviderChatResult> {
      if (!canUseGroq(request.dataClass, zdrConfirmed)) {
        throw new Error(`Groq provider blocked for data class "${request.dataClass}" without verified ZDR`)
      }

      const model = request.model ?? defaultModel
      const response = await fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildGroqChatBody(model, request)),
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (!response.ok) {
        throw new Error(`Groq returned HTTP ${response.status}`)
      }

      const payload = await response.json()
      const content = payload?.choices?.[0]?.message?.content
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('Groq returned an empty completion')
      }

      return {
        content: content.trim(),
        model,
        provider: 'groq',
        usage: extractUsage(payload),
        fallbackUsed: false,
      }
    },
  }
}

export function isGroqZdrConfirmed(): boolean {
  return Deno.env.get('GROQ_ZDR_CONFIRMED')?.trim().toLowerCase() === 'true'
}

export async function screenPromptWithGroq(
  text: string,
  dataClass: string,
): Promise<{ blocked: boolean; label: string; checked: boolean; usage: OpenRouterUsage }> {
  const groqKey = Deno.env.get('GROQ_API_KEY')?.trim()
  const emptyUsage: OpenRouterUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  if (!groqKey || !canUseGroq(dataClass, isGroqZdrConfirmed())) {
    return { blocked: false, label: 'SKIPPED', checked: false, usage: emptyUsage }
  }

  const slices = sliceForPromptGuard(text)
  if (slices.length === 0) {
    return { blocked: false, label: 'EMPTY', checked: false, usage: emptyUsage }
  }

  const provider = createGroqProvider(groqKey, {
    zdrConfirmed: isGroqZdrConfirmed(),
    model: Deno.env.get('GROQ_GUARD_MODEL')?.trim() || DEFAULT_GROQ_GUARD_MODEL,
    timeoutMs: 8_000,
  })

  const totalUsage: OpenRouterUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  try {
    for (const slice of slices) {
      const result = await provider.generateChat({
        messages: [{ role: 'user', content: slice }],
        maxTokens: 16,
        temperature: 0,
        dataClass,
      })
      totalUsage.promptTokens += result.usage.promptTokens
      totalUsage.completionTokens += result.usage.completionTokens
      totalUsage.totalTokens += result.usage.totalTokens

      const verdict = classifyPromptGuardOutput(result.content)
      if (verdict.blocked) {
        return { blocked: true, label: verdict.label, checked: true, usage: totalUsage }
      }
    }
    return { blocked: false, label: 'BENIGN', checked: true, usage: totalUsage }
  } catch (error) {
    console.warn('Groq prompt guard skipped after transient failure:', error)
    return { blocked: false, label: 'UNAVAILABLE', checked: false, usage: totalUsage }
  }
}

export async function rewriteQueryWithHistory(
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<{ query: string; usage: OpenRouterUsage; model: string }> {
  const groqKey = Deno.env.get('GROQ_API_KEY')?.trim()
  const model = Deno.env.get('GROQ_FAST_MODEL')?.trim() || DEFAULT_GROQ_FAST_MODEL
  const emptyUsage: OpenRouterUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  if (!groqKey || history.length === 0) {
    return { query: question, usage: emptyUsage, model }
  }

  try {
    const provider = createGroqProvider(groqKey, {
      zdrConfirmed: isGroqZdrConfirmed(),
      model,
      timeoutMs: 10_000,
    })
    const formattedHistory = history
      .map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`)
      .join('\n')

    const result = await provider.generateChat({
      messages: [
        {
          role: 'system',
          content:
            'Rewrite the latest legal research follow-up question into a concise standalone search query (under 25 words) using the conversation history. Output only the rewritten search query with no explanation or quotes.',
        },
        {
          role: 'user',
          content: `Conversation history:\n${formattedHistory}\n\nLatest question: ${question}`,
        },
      ],
      maxTokens: 120,
      temperature: 0,
      dataClass: DATA_CLASSES.A_PUBLIC,
    })

    const rewritten = result.content.replace(/^["']|["']$/g, '').trim()
    return {
      query: rewritten.length >= 3 && rewritten.length <= 300 ? rewritten : question,
      usage: result.usage,
      model: result.model,
    }
  } catch (error) {
    console.warn('Groq query rewrite failed; using original question:', error)
    return { query: question, usage: emptyUsage, model }
  }
}

export async function generateClassAFallbackWithGroq(
  request: { messages: OpenRouterMessage[]; maxTokens: number; temperature?: number },
): Promise<ProviderChatResult | null> {
  const groqKey = Deno.env.get('GROQ_API_KEY')?.trim()
  if (!groqKey) return null

  const model = Deno.env.get('GROQ_CLASS_A_FALLBACK_MODEL')?.trim() || DEFAULT_GROQ_CLASS_A_FALLBACK
  const provider = createGroqProvider(groqKey, {
    zdrConfirmed: isGroqZdrConfirmed(),
    model,
    timeoutMs: 25_000,
  })
  const result = await provider.generateChat({
    ...request,
    dataClass: DATA_CLASSES.A_PUBLIC,
  })
  return {
    ...result,
    fallbackUsed: true,
  }
}

export async function checkDailyTokenBudget(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  dailyLimit?: number,
): Promise<{ allowed: boolean; usedTokens: number; remainingTokens: number }> {
  const parsedEnvLimit = Number.parseInt(Deno.env.get('AI_DAILY_TOKEN_BUDGET') ?? '', 10)
  const limit = dailyLimit
    ?? (Number.isFinite(parsedEnvLimit) && parsedEnvLimit >= 1000 ? parsedEnvLimit : DEFAULT_DAILY_TOKEN_BUDGET)

  try {
    const { data, error } = await supabase.rpc('check_ai_token_budget', { p_daily_limit: limit })
    if (error) {
      if (error.code === '42883' || error.code === 'PGRST202') {
        console.warn('check_ai_token_budget RPC not yet deployed; skipping token budget check.')
        return { allowed: true, usedTokens: 0, remainingTokens: limit }
      }
      console.warn('Daily token budget check failed:', error)
      return { allowed: true, usedTokens: 0, remainingTokens: limit }
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row || typeof row !== 'object') {
      return { allowed: true, usedTokens: 0, remainingTokens: limit }
    }
    return {
      allowed: row.allowed !== false,
      usedTokens: typeof row.used_tokens === 'number' ? row.used_tokens : 0,
      remainingTokens: typeof row.remaining_tokens === 'number' ? row.remaining_tokens : limit,
    }
  } catch (err) {
    console.warn('Daily token budget check threw unexpectedly:', err)
    return { allowed: true, usedTokens: 0, remainingTokens: limit }
  }
}

export async function recordAiUsage(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  entry: {
    feature: 'ask' | 'ask_user_document' | 'draft_document' | 'process_user_document'
    provider: string
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    status?: 'ok' | 'error' | 'blocked'
    fallbackUsed?: boolean
  },
): Promise<void> {
  try {
    const { error } = await supabase.rpc('record_ai_usage', {
      p_feature: entry.feature,
      p_provider: entry.provider,
      p_model: entry.model,
      p_prompt_tokens: Math.max(0, Math.floor(entry.promptTokens)),
      p_completion_tokens: Math.max(0, Math.floor(entry.completionTokens)),
      p_total_tokens: Math.max(0, Math.floor(entry.totalTokens)),
      p_status: entry.status ?? 'ok',
      p_fallback_used: Boolean(entry.fallbackUsed),
    })
    if (error && error.code !== '42883' && error.code !== 'PGRST202') {
      console.warn('Failed to record AI usage:', error)
    }
  } catch (err) {
    console.warn('Unexpected error recording AI usage:', err)
  }
}
