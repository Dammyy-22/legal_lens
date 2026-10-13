export const DEFAULT_RATE_LIMIT = Object.freeze({
  windowMs: 60_000,
  maxRequests: 20,
})

export function normalizeQuestion(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  return trimmed || null
}

export function extractCitationIds(answerText = '') {
  const matches = [...String(answerText).matchAll(/\[\[cite:([a-zA-Z0-9-]+)\]\]/g)]
  return [...new Set(matches.map((match) => match[1]))]
}

export function selectValidCitationIds(citedChunkIds, retrievedIds = []) {
  const validIds = new Set(retrievedIds)
  return [...new Set((citedChunkIds ?? []).filter((id) => validIds.has(id)))]
}

export function buildSourceExtract(question, chunks) {
  const stopWords = new Set([
    'about', 'after', 'against', 'also', 'and', 'are', 'can', 'does', 'for',
    'from', 'have', 'how', 'into', 'its', 'may', 'not', 'say', 'says', 'should',
    'that', 'the', 'their', 'them', 'then', 'there', 'they', 'this', 'under',
    'was', 'were', 'what', 'when', 'where', 'which', 'who', 'will', 'with',
    'would', 'you', 'your',
  ])
  const terms = [...new Set(
    question.toLowerCase().match(/[a-z]{3,}|\d+/g)?.filter((term) => !stopWords.has(term)) ?? []
  )]
  const candidates = []

  for (const chunk of chunks) {
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
