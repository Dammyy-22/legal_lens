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

// Records the user's consent on the server (append-only audit log). The Edge
// Functions refuse to process content unless this has been recorded.
export async function recordConsent(purpose: ConsentPurpose): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('grant_consent', {
    p_purpose: purpose,
    p_policy_version: CONSENT_POLICY_VERSION,
  })
  if (error) throw new Error('We could not record your consent. Please try again.')
}

// Records consent only if there is no current consent yet, so the audit log is
// not filled with a new event on every action.
export async function ensureConsent(purpose: ConsentPurpose): Promise<void> {
  if (await hasCurrentConsent(purpose)) return
  await recordConsent(purpose)
}

export async function withdrawConsent(purpose: ConsentPurpose): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('withdraw_consent', { p_purpose: purpose })
  if (error) throw new Error('We could not withdraw your consent. Please try again.')
}

export async function hasCurrentConsent(purpose: ConsentPurpose): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('has_current_consent', {
    p_purpose: purpose,
    p_policy_version: CONSENT_POLICY_VERSION,
  })
  if (error) return false
  return data === true
}
