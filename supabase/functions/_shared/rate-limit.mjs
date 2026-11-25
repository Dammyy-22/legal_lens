// Atomic distributed rate limiting backed by Postgres RPC `consume_rate_limit`
// with bounded in-memory sliding-window fallback during rolling deployments,
// plus chunked-safe JSON body size enforcement.

export async function enforceRateLimit(supabase, userId, action, config, fallbackBuckets) {
  const maxRequests = config.maxRequests
  const windowSeconds = config.windowSeconds

  if (supabase && typeof supabase.rpc === 'function') {
    try {
      const { data, error } = await supabase.rpc('consume_rate_limit', {
        p_action: action,
        p_max_requests: maxRequests,
        p_window_seconds: windowSeconds,
      })

      if (!error && Array.isArray(data) && data.length > 0) {
        const row = data[0]
        return {
          allowed: row.allowed === true,
          remaining: Math.max(Number(row.remaining ?? 0), 0),
          retryAfterSeconds: Math.max(Number(row.retry_after_seconds ?? 0), 0),
          limit: maxRequests,
          source: 'database',
        }
      }
      if (error) {
        console.warn('consume_rate_limit RPC unavailable; falling back to per-isolate limit:', error.code ?? error.message)
      }
    } catch (err) {
      console.warn('consume_rate_limit RPC threw; falling back to per-isolate limit:', err)
    }
  }

  return checkMemoryRateLimit(userId, action, maxRequests, windowSeconds, fallbackBuckets)
}

export function checkMemoryRateLimit(userId, action, maxRequests, windowSeconds, buckets) {
  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const key = `${action}:${userId}`

  if (buckets.size > 1000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k)
    }
  }

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return {
      allowed: true,
      remaining: Math.max(maxRequests - 1, 0),
      retryAfterSeconds: 0,
      limit: maxRequests,
      source: 'memory',
    }
  }

  if (existing.count >= maxRequests) {
    const retryAfterSeconds = Math.max(Math.ceil((existing.resetAt - now) / 1000), 1)
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
      limit: maxRequests,
      source: 'memory',
    }
  }

  existing.count += 1
  return {
    allowed: true,
    remaining: Math.max(maxRequests - existing.count, 0),
    retryAfterSeconds: 0,
    limit: maxRequests,
    source: 'memory',
  }
}

export function rateLimitHeaders(state) {
  return {
    'X-RateLimit-Limit': String(state.limit),
    'X-RateLimit-Remaining': String(state.remaining),
    ...(state.allowed ? {} : { 'Retry-After': String(Math.max(state.retryAfterSeconds, 1)) }),
  }
}

export async function readBoundedJson(request, maxBytes) {
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, status: 413, error: 'Request body is too large' }
  }

  if (!request.body) {
    return { ok: false, status: 400, error: 'Invalid JSON body' }
  }

  const reader = request.body.getReader()
  const chunks = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {})
        return { ok: false, status: 413, error: 'Request body is too large' }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON body' }
  }

  const merged = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(merged)
    return { ok: true, data: JSON.parse(text) }
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON body' }
  }
}
