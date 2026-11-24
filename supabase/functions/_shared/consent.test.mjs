import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { checkConsent, CONSENT_POLICY_VERSION, CONSENT_PURPOSES } from './consent.mjs'

const fakeClient = (response) => ({
  calls: [],
  async rpc(name, args) {
    this.calls.push({ name, args })
    if (response instanceof Error) throw response
    return response
  },
})

test('allows processing only when the database says consent is current', async () => {
  const client = fakeClient({ data: true, error: null })
  const result = await checkConsent(client, CONSENT_PURPOSES.privateDocuments)
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(client.calls, [{
    name: 'has_current_consent',
    args: { p_purpose: 'private_document_processing', p_policy_version: CONSENT_POLICY_VERSION },
  }])
})

test('refuses with 403 consent_required when consent is missing, withdrawn or outdated', async () => {
  for (const data of [false, null, undefined, 'true', 1]) {
    const result = await checkConsent(fakeClient({ data, error: null }), CONSENT_PURPOSES.drafting)
    assert.equal(result.ok, false)
    assert.equal(result.status, 403)
    assert.equal(result.body.code, 'consent_required')
    assert.equal(result.body.purpose, 'drafting_assistance')
    assert.equal(result.body.required_version, CONSENT_POLICY_VERSION)
  }
})

test('fails closed (503) when the check errors or throws', async () => {
  for (const response of [{ data: null, error: { message: 'boom' } }, undefined, new Error('network')]) {
    const result = await checkConsent(fakeClient(response), CONSENT_PURPOSES.privateDocuments)
    assert.equal(result.ok, false)
    assert.equal(result.status, 503)
    assert.equal(result.body.code, 'consent_check_failed')
  }
})

test('server and web consent policy versions are identical', () => {
  const web = readFileSync(new URL('../../../apps/web/lib/consent.ts', import.meta.url), 'utf8')
  const match = web.match(/CONSENT_POLICY_VERSION\s*=\s*'([^']+)'/)
  assert.ok(match, 'apps/web/lib/consent.ts must export CONSENT_POLICY_VERSION')
  assert.equal(match[1], CONSENT_POLICY_VERSION)
})

test('every function that sends user content to a model enforces the consent gate', () => {
  const guarded = {
    'create-user-document-upload': 'privateDocuments',
    'process-user-document': 'privateDocuments',
    'ask-user-document': 'privateDocuments',
    'draft-document': 'drafting',
  }
  for (const [fn, purpose] of Object.entries(guarded)) {
    const src = readFileSync(new URL(`../${fn}/index.ts`, import.meta.url), 'utf8')
    assert.match(src, /checkConsent\(/, `${fn} must call checkConsent`)
    assert.match(src, new RegExp(`CONSENT_PURPOSES\\.${purpose}`), `${fn} must use the ${purpose} purpose`)
    assert.ok(
      src.indexOf('checkConsent(') > src.indexOf('auth.getUser()'),
      `${fn} must check consent after authentication`,
    )
  }
})
