export function buildCorsHeaders(request, methods = 'POST, OPTIONS') {
  const rawAllowed = typeof Deno !== 'undefined'
    ? Deno.env.get('ALLOWED_ORIGINS') ?? ''
    : ''
  const allowedOrigins = rawAllowed
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  const requestOrigin = request?.headers?.get('Origin')?.trim() ?? ''
  let allowOrigin = '*'

  if (allowedOrigins.length > 0) {
    allowOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0]
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': methods,
    ...(allowedOrigins.length > 0 ? { Vary: 'Origin' } : {}),
  }
}
