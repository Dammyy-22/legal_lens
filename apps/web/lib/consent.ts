import { createClient } from '@/lib/supabase/client'

// MUST equal CONSENT_POLICY_VERSION in supabase/functions/_shared/consent.mjs
// (a test there fails if they drift). Bump when the consent wording changes;
// everyone is then asked again because the server only accepts the current version.
export const CONSENT_POLICY_VERSION = '2026-11-v1'

export type ConsentPurpose = 'private_document_processing' | 'drafting_assistance' | 'legal_qa'

export const CONSENT_PURPOSES: Record<string, ConsentPurpose> = {
  privateDocuments: 'private_document_processing',
  drafting: 'drafting_assistance',
  legalQa: 'legal_qa',
}

function localConsentKey(purpose: ConsentPurpose): string {
  return `legalens_consent_${purpose}_${CONSENT_POLICY_VERSION}`
}

function isLegalQaSchemaFallback(
  purpose: ConsentPurpose,
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (purpose !== CONSENT_PURPOSES.legalQa || !error) return false
  if (error.code === '23514' || error.code === '42883' || error.code === 'PGRST202') return true
  return /user_consent_events|purpose/i.test(error.message ?? '')
}

function setLocalConsent(purpose: ConsentPurpose, granted: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (granted) {
      window.localStorage.setItem(localConsentKey(purpose), 'granted')
    } else {
      window.localStorage.removeItem(localConsentKey(purpose))
    }
  } catch {
    // Ignore storage quota/privacy mode failures.
  }
}

function hasLocalConsent(purpose: ConsentPurpose): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(localConsentKey(purpose)) === 'granted'
  } catch {
    return false
  }
}

// Records the user's consent on the server (append-only audit log). The Edge
// Functions refuse to process content unless this has been recorded.
export async function recordConsent(purpose: ConsentPurpose): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('grant_consent', {
    p_purpose: purpose,
    p_policy_version: CONSENT_POLICY_VERSION,
  })
  if (error) {
    if (isLegalQaSchemaFallback(purpose, error)) {
      console.warn('legal_qa consent migration not yet applied in database; recording local fallback.', error.code)
      setLocalConsent(purpose, true)
      return
    }
    throw new Error('We could not record your consent. Please try again.')
  }
  setLocalConsent(purpose, true)
}

// Records consent only if there is no current consent yet, so the audit log is
// not filled with a new event on every action.
export async function ensureConsent(purpose: ConsentPurpose): Promise<void> {
  if (await hasCurrentConsent(purpose)) return
  await recordConsent(purpose)
}

export async function withdrawConsent(purpose: ConsentPurpose): Promise<void> {
  const supabase = createClient()
  setLocalConsent(purpose, false)
  const { error } = await supabase.rpc('withdraw_consent', { p_purpose: purpose })
  if (error && !isLegalQaSchemaFallback(purpose, error)) {
    throw new Error('We could not withdraw your consent. Please try again.')
  }
}

export async function hasCurrentConsent(purpose: ConsentPurpose): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('has_current_consent', {
    p_purpose: purpose,
    p_policy_version: CONSENT_POLICY_VERSION,
  })
  if (data === true) return true
  if (purpose === CONSENT_PURPOSES.legalQa && (error || data === false)) {
    return hasLocalConsent(purpose)
  }
  if (error) return false
  return false
}
