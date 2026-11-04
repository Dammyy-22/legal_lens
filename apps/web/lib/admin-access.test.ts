import assert from 'node:assert/strict'
import test from 'node:test'

import { getEffectiveAdminRoles, getServerAdminAccess } from './admin-access.ts'

test('normalizes legacy admin role metadata', () => {
  const roles = getEffectiveAdminRoles({
    app_metadata: {
      role: 'admin',
    },
  })

  assert.deepEqual(roles, ['super_admin'])
})

test('supports the reviewer role with MFA', () => {
  const access = getServerAdminAccess(
    {
      app_metadata: {
        role: 'reviewer',
      },
      amr: [{ method: 'totp' }],
    },
    'reviewer',
  )

  assert.equal(access.allowed, true)
  assert.equal(access.highestRole, 'reviewer')
})

test('denies privileged access without MFA', () => {
  const access = getServerAdminAccess(
    {
      app_metadata: {
        role: 'corpus_admin',
      },
    },
    'reviewer',
  )

  assert.equal(access.allowed, false)
  assert.equal(access.reason, 'mfa_required')
})

test('rejects ordinary users even with a non-admin role value', () => {
  const access = getServerAdminAccess(
    {
      app_metadata: {
        role: 'user',
      },
      amr: [{ method: 'totp' }],
    },
    'reviewer',
  )

  assert.equal(access.allowed, false)
  assert.equal(access.reason, 'missing_admin_role')
})
