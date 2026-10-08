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
