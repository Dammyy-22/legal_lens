export type AdminRole = 'super_admin' | 'corpus_admin' | 'reviewer'

export type AdminRoleRequirement = AdminRole | 'user'

export interface AdminUserLike {
  app_metadata?: Record<string, unknown> | null
  amr?: Array<{ method?: string | null }> | null
}

const ADMIN_ROLE_PRIORITY: Record<AdminRole, number> = {
  super_admin: 3,
  corpus_admin: 2,
  reviewer: 1,
}

function normalizeRoleName(value: string): AdminRole | null {
  const normalized = value.trim().toLowerCase().replace(/[-\s]+/g, '_')

  if (!normalized) return null

  switch (normalized) {
    case 'admin':
    case 'super_admin':
      return 'super_admin'
    case 'corpus_admin':
    case 'corpus-admin':
      return 'corpus_admin'
    case 'reviewer':
      return 'reviewer'
    default:
      return null
  }
}

function asStringArray(value: string | string[] | null | undefined): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string')
  }
  return [value]
}

export function getEffectiveAdminRoles(user: AdminUserLike | null | undefined): AdminRole[] {
  if (!user?.app_metadata) return []

  const metadataRoles = [
    ...asStringArray(user.app_metadata.role as string | string[] | null | undefined),
    ...asStringArray(user.app_metadata.roles as string | string[] | null | undefined),
  ]

  const roles = new Set<AdminRole>()

  for (const rawRole of metadataRoles) {
    const normalized = normalizeRoleName(rawRole)
    if (normalized) {
      roles.add(normalized)
    }
  }

  return Array.from(roles).sort((left, right) => ADMIN_ROLE_PRIORITY[right] - ADMIN_ROLE_PRIORITY[left])
}

export function getHighestAdminRole(user: AdminUserLike | null | undefined): AdminRole | null {
  const roles = getEffectiveAdminRoles(user)
  return roles[0] ?? null
}

function hasStrongMfa(amr: Array<{ method?: string | null }> | null | undefined): boolean {
  if (!amr) return false

  const methods = new Set(
    amr
      .map((entry) => entry?.method)
      .filter((method): method is string => typeof method === 'string')
      .map((method) => method.trim().toLowerCase())
  )

  return methods.has('totp') || methods.has('webauthn') || methods.has('fido')
}

export function hasAdminMfa(user: AdminUserLike | null | undefined): boolean {
  return hasStrongMfa(user?.amr ?? null)
}

export function getServerAdminAccess(
  user: AdminUserLike | null | undefined,
  minimumRole: AdminRoleRequirement = 'reviewer',
): {
  allowed: boolean
  roles: AdminRole[]
  highestRole: AdminRole | null
  reason: 'missing_user' | 'missing_admin_role' | 'mfa_required' | 'insufficient_role' | 'allowed'
} {
  if (!user) {
    return {
      allowed: false,
      roles: [],
      highestRole: null,
      reason: 'missing_user',
    }
  }

  const roles = getEffectiveAdminRoles(user)
  const highestRole = roles[0] ?? null

  if (!highestRole) {
    return {
      allowed: false,
      roles: [],
      highestRole: null,
      reason: 'missing_admin_role',
    }
  }

  const minimumPriority = ADMIN_ROLE_PRIORITY[minimumRole as AdminRole] ?? 0
  const highestPriority = highestRole ? ADMIN_ROLE_PRIORITY[highestRole] : 0

  if (highestPriority < minimumPriority) {
    return {
      allowed: false,
      roles,
      highestRole,
      reason: 'insufficient_role',
    }
  }

  if (!hasAdminMfa(user)) {
    return {
      allowed: false,
      roles,
      highestRole,
      reason: 'mfa_required',
    }
  }

  return {
    allowed: true,
    roles,
    highestRole,
    reason: 'allowed',
  }
}
