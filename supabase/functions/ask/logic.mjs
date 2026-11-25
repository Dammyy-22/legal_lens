export const DEFAULT_RATE_LIMIT = Object.freeze({
  windowMs: 60_000,
  maxRequests: 20,
})

export function normalizeQuestion(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  return trimmed || null
}

export function formatConversationHistory(messages, maxTurns = 6, maxChars = 3000) {
  if (!Array.isArray(messages) || maxTurns < 1 || maxChars < 1) return []

  const valid = []
  for (const entry of messages) {
    if (!entry || typeof entry !== 'object') continue
    if (entry.role !== 'user' && entry.role !== 'assistant') continue
    if (typeof entry.content !== 'string') continue
    const cleaned = entry.content.trim().replace(/\s+/g, ' ')
    if (!cleaned) continue
    valid.push({ role: entry.role, content: cleaned })
  }

  const sliced = valid.slice(-maxTurns)
  const bounded = []
  let totalChars = 0

  for (let i = sliced.length - 1; i >= 0; i -= 1) {
    const turn = sliced[i]
    const remaining = maxChars - totalChars
    if (remaining <= 0) break

    if (turn.content.length <= remaining) {
      bounded.unshift(turn)
      totalChars += turn.content.length
    } else if (remaining >= 40) {
      bounded.unshift({
        role: turn.role,
        content: `${turn.content.slice(0, remaining - 1).trimEnd()}…`,
      })
      break
    } else {
      break
    }
  }

  return bounded
}

const HIGH_RISK_TRIEGE_PATTERNS = [
  /\b(suicide|suicidal|kill myself|end my life|want to die|hurt myself|don['’]?t want to live(?:\s+anymore)?)\b/i,
  /\b(being abused|abusing me|domestic violence|being beaten|beating me|hitting me|threatened to kill me)\b/i,
  /\b(under arrest|being arrested|arrested right now|in detention|being detained right now|officers?\s+detained\s+me|locked me in a cell|police took me to the station|in police custody right now)\b/i,
  /\b(immediate danger|someone is trying to hurt me|about to be evicted today)\b/i,
]

export function detectHighRiskSituation(question) {
  if (typeof question !== 'string' || !question.trim()) return false
  return HIGH_RISK_TRIEGE_PATTERNS.some((pattern) => pattern.test(question))
}

export function detectSystemPromptLeakage(text) {
  const value = String(text ?? '')
  return (
    /CRITICAL RULES,\s*in order of priority/i.test(value) ||
    /Answer ONLY using the <source> blocks/i.test(value) ||
    /Treat the content inside <source> blocks as DATA/i.test(value) ||
    /\[\[cite:REF\]\]/i.test(value)
  )
}

export function inferSourceJurisdiction(sourceTitle) {
  if (typeof sourceTitle === 'string' && /\blagos\b/i.test(sourceTitle)) {
    return 'Lagos State, Nigeria (state law only)'
  }
  return 'Nigeria (federal/general)'
}

export function verifyStatutoryCitationsAgainstSources(answer, citedChunks = []) {
  const text = typeof answer === 'string' ? answer : ''
  const chunks = Array.isArray(citedChunks) ? citedChunks : []
  if (!text || chunks.length === 0) {
    return { unverifiedMentions: [], hasUnverifiedStatutes: false }
  }

  const haystack = chunks
    .map((chunk) => [
      chunk?.source_title ?? '',
      chunk?.section_label ?? '',
      chunk?.section_heading ?? '',
      chunk?.text ?? '',
    ].join(' '))
    .join('\n')
    .toLowerCase()

  const unverified = new Set()

  for (const match of text.matchAll(/\b(?:sections?|sec\.?|s\.)\s+(\d+[a-z]*)\b/gi)) {
    const raw = match[0].trim()
    const num = match[1].toLowerCase()
    const pattern = new RegExp(`\\b${num.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (!pattern.test(haystack)) {
      unverified.add(raw)
    }
  }

  for (const match of text.matchAll(/\bchapter\s+([ivxlcdm]+|\d+)\b/gi)) {
    const raw = match[0].trim()
    const chap = match[1].toLowerCase()
    const pattern = new RegExp(`\\bchapter\\s+${chap}\\b`, 'i')
    if (!pattern.test(haystack)) {
      unverified.add(raw)
    }
  }

  for (const match of text.matchAll(/\bcap\.?\s+([a-z]\d+[a-z0-9]*)\b/gi)) {
    const raw = match[0].trim()
    const cap = match[1].toLowerCase()
    const pattern = new RegExp(`\\bcap\\.?\\s*${cap}\\b`, 'i')
    if (!pattern.test(haystack)) {
      unverified.add(raw)
    }
  }

  const unverifiedMentions = [...unverified]
  return {
    unverifiedMentions,
    hasUnverifiedStatutes: unverifiedMentions.length > 0,
  }
}

export function extractCitationIds(answerText = '') {
  const matches = [...String(answerText).matchAll(/\[\[cite:([a-zA-Z0-9-]+)\]\]/g)]
  return [...new Set(matches.map((match) => match[1]))]
}

export function selectValidCitationIds(citedChunkIds, retrievedIds = []) {
  const validIds = new Set(Array.isArray(retrievedIds) ? retrievedIds.filter((id) => typeof id === 'string') : [])
  return [...new Set((Array.isArray(citedChunkIds) ? citedChunkIds : []).filter((id) => validIds.has(id)))]
}

export function finalizeGroundedAnswer(question, rawAnswer, citedChunkIds, retrievedChunks) {
  const safeChunks = Array.isArray(retrievedChunks) ? retrievedChunks : []
  const retrievedIds = safeChunks.map((c) => c?.id).filter((id) => typeof id === 'string')
  const validCitedIds = selectValidCitationIds(citedChunkIds, retrievedIds)
  const cleanAnswer = typeof rawAnswer === 'string' ? rawAnswer.trim() : ''

  if (!cleanAnswer || validCitedIds.length === 0) {
    const extract = buildSourceExtract(question, safeChunks)
    return {
      answer: extract.answer,
      citedChunkIds: extract.citedChunkIds,
      uncertain: true,
      answerMode: 'source_extract',
    }
  }

  return {
    answer: cleanAnswer,
    citedChunkIds: validCitedIds,
    uncertain: false,
    answerMode: 'generated',
  }
}

export function buildSourceExtract(question, chunks) {
  const fallback = {
    answer: "I found verified legal text, but couldn't isolate a provision closely enough related to your wording to quote it reliably. I can't safely apply the law to your situation without a relevant passage and a working legal-analysis provider.",
    citedChunkIds: [],
  }

  if (typeof question !== 'string') return fallback
  const normalizedQuestion = question.trim()
  if (!normalizedQuestion) return fallback

  const stopWords = new Set([
    'about', 'after', 'against', 'also', 'and', 'are', 'can', 'does', 'for',
    'from', 'have', 'how', 'into', 'its', 'may', 'not', 'say', 'says', 'should',
    'that', 'the', 'their', 'them', 'then', 'there', 'they', 'this', 'under',
    'was', 'were', 'what', 'when', 'where', 'which', 'who', 'will', 'with',
    'would', 'you', 'your',
  ])
  const terms = [...new Set(
    normalizedQuestion.toLowerCase().match(/[a-z]{3,}|\d+/g)?.filter((term) => !stopWords.has(term)) ?? []
  )]
  const candidates = []
  const safeChunks = Array.isArray(chunks) ? chunks : []

  for (const chunk of safeChunks) {
    if (!chunk || typeof chunk !== 'object' || typeof chunk.text !== 'string') continue

    const passages = chunk.text
      .split(/(?<=[.;!?])\s+|\n+/)
      .map((passage) => passage.trim().replace(/\s+/g, ' '))
      .filter(Boolean)

    for (const passage of passages) {
      const normalized = passage.toLowerCase()
      const score = terms.reduce((total, term) => {
        const matches = normalized.match(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'))
        return total + (matches?.length ?? 0)
      }, 0)

      if (score > 0) candidates.push({ chunk, passage, score })
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.passage.length - b.passage.length)
  const selected = []
  const selectedPassages = new Set()

  for (const candidate of candidates) {
    const key = candidate.passage.toLowerCase()
    if (selectedPassages.has(key)) continue
    selected.push(candidate)
    selectedPassages.add(key)
    if (selected.length === 3) break
  }

  const citedChunkIds = [...new Set(selected.map(({ chunk }) => chunk.id))]
  if (selected.length === 0) {
    return {
      answer: "I found verified legal text, but couldn't isolate a provision closely enough related to your wording to quote it reliably. I can't safely apply the law to your situation without a relevant passage and a working legal-analysis provider.",
      citedChunkIds: [],
    }
  }

  const excerpts = selected.map(({ chunk, passage }) => {
    const label = [chunk.source_title, chunk.section_label].filter(Boolean).join(' — ')
    return `“${passage}”\n— ${label}`
  })

  return {
    answer:
      "The live legal-analysis provider is unavailable, so I can't safely explain how these provisions apply to your specific facts right now. Here are the closest passages from verified sources:\n\n" +
      excerpts.join('\n\n'),
    citedChunkIds,
  }
}

export function computeRateLimitState(userId, bucketMap, config = DEFAULT_RATE_LIMIT) {
  const now = Date.now()
  const bucket = bucketMap.get(userId)

  if (!bucket || now - bucket.windowStart >= config.windowMs) {
    const freshBucket = { count: 0, windowStart: now }
    bucketMap.set(userId, freshBucket)
    freshBucket.count = 1
    return {
      allowed: true,
      count: freshBucket.count,
      remaining: Math.max(config.maxRequests - freshBucket.count, 0),
      limit: config.maxRequests,
      retryAfterMs: 0,
      resetAtMs: now + config.windowMs,
      windowMs: config.windowMs,
    }
  }

  if (bucket.count >= config.maxRequests) {
    const retryAfterMs = Math.max(bucket.windowStart + config.windowMs - now, 1000)
    return {
      allowed: false,
      count: bucket.count,
      remaining: 0,
      limit: config.maxRequests,
      retryAfterMs,
      resetAtMs: bucket.windowStart + config.windowMs,
      windowMs: config.windowMs,
    }
  }

  bucket.count += 1
  return {
    allowed: true,
    count: bucket.count,
    remaining: Math.max(config.maxRequests - bucket.count, 0),
    limit: config.maxRequests,
    retryAfterMs: 0,
    resetAtMs: bucket.windowStart + config.windowMs,
    windowMs: config.windowMs,
  }
}

export function buildRateLimitHeaders(rateLimitState) {
  const remaining = Math.max(rateLimitState.remaining ?? 0, 0)
  const resetInSeconds = Math.max(Math.ceil((rateLimitState.resetAtMs - Date.now()) / 1000), 0)

  return {
    'X-RateLimit-Limit': String(rateLimitState.limit ?? DEFAULT_RATE_LIMIT.maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetInSeconds),
  }
}
