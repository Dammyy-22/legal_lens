export const SESSION_INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000

export function sessionActivityStorageKey(sessionId: string): string {
  return `legalens:session:last-activity:${sessionId}`
}

export function sessionIdFromAccessToken(accessToken: string): string {
  const encodedPayload = accessToken.split('.')[1]
  if (!encodedPayload) throw new Error('The authentication token is malformed.')

  const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
  const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as {
    session_id?: unknown
  }
  if (typeof payload.session_id !== 'string' || !payload.session_id) {
    throw new Error('The authentication token does not identify its session.')
  }
  return payload.session_id
}

export function isSessionInactive(lastActivity: string | null, now = Date.now()): boolean {
  if (lastActivity === null) return false
  const timestamp = Number(lastActivity)
  return !Number.isFinite(timestamp) || timestamp > now ||
    now - timestamp >= SESSION_INACTIVITY_TIMEOUT_MS
}
