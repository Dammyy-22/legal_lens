import process from 'node:process'

export function validateStagingConfig(env = process.env) {
  const issues = []

  const required = {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
    SUPABASE_AUTH_EMAIL: env.SUPABASE_AUTH_EMAIL,
    SUPABASE_AUTH_PASSWORD: env.SUPABASE_AUTH_PASSWORD,
  }

  for (const [name, value] of Object.entries(required)) {
    if (!value || !String(value).trim()) {
      issues.push(`${name} is missing or empty.`)
    }
  }

  if (env.SUPABASE_URL && !/^https:\/\/[a-z0-9-]+\.supabase\.co(\/.*)?$/i.test(env.SUPABASE_URL.trim())) {
    issues.push('SUPABASE_URL must point to a Supabase project endpoint such as https://<project-ref>.supabase.co.')
  }

  if (
    env.NEXT_PUBLIC_SUPABASE_URL &&
    env.SUPABASE_URL &&
    env.NEXT_PUBLIC_SUPABASE_URL !== env.SUPABASE_URL
  ) {
    issues.push('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_URL must refer to the same staging project.')
  }

  if (
    env.NEXT_PUBLIC_SUPABASE_URL &&
    env.NEXT_PUBLIC_SUPABASE_URL.includes('localhost')
  ) {
    issues.push('NEXT_PUBLIC_SUPABASE_URL must not point to localhost for staging verification.')
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

export function requireStagingConfig(env = process.env, { allowMissing = false } = {}) {
  const result = validateStagingConfig(env)

  if (allowMissing && result.ok) {
    return result
  }

  if (!result.ok) {
    const message = result.issues.join('\n')
    throw new Error(message)
  }

  return result
}
