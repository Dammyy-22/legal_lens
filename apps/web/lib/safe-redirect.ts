export function safeLocalRedirectPath(
  candidate: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (
    !candidate ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback
  }

  try {
    const parsed = new URL(candidate, 'https://legallens.invalid')
    if (parsed.origin !== 'https://legallens.invalid') return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

export function buildSafeAuthCallbackUrl(
  origin: string,
  next: string | null | undefined,
  fallback = '/dashboard',
): string {
  const safeNext = safeLocalRedirectPath(next, fallback)
  const callbackUrl = new URL('/auth/callback', origin)
  callbackUrl.searchParams.set('next', safeNext)
  return callbackUrl.toString()
}
