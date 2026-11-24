// Server-side consent gate (issue LL-020). The browser checkbox is a UX step;
// this is the enforcement: functions that send user content to a model call
// checkConsent() right after authentication and refuse (fail closed) unless the
// caller's latest recorded consent for the purpose is a grant of the CURRENT
// policy version. The database function runs as the caller, so RLS scopes it.

// MUST equal CONSENT_POLICY_VERSION in apps/web/lib/consent.ts
// (a test in this folder fails if they drift). Bump when the consent wording changes.
export const CONSENT_POLICY_VERSION = '2026-11-v1'

export const CONSENT_PURPOSES = Object.freeze({
  privateDocuments: 'private_document_processing',
  drafting: 'drafting_assistance',
})

export async function checkConsent(client, purpose, version = CONSENT_POLICY_VERSION) {
  let result
  try {
    result = await client.rpc('has_current_consent', {
      p_purpose: purpose,
      p_policy_version: version,
    })
  } catch {
    return unavailable()
  }
  if (!result || result.error) return unavailable()
  if (result.data !== true) {
    return {
      ok: false,
      status: 403,
      body: {
        error: 'Your consent is required before this content can be processed.',
        code: 'consent_required',
        purpose,
        required_version: version,
      },
    }
  }
  return { ok: true }
}

function unavailable() {
  // Fail closed: if consent cannot be verified, nothing is sent to a provider.
  return {
    ok: false,
    status: 503,
    body: { error: 'Could not verify your consent right now. Please try again.', code: 'consent_check_failed' },
  }
}
