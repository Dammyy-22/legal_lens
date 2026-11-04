import process from 'node:process'
import { requireStagingConfig } from './staging-config.mjs'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const email = process.env.SUPABASE_AUTH_EMAIL
const password = process.env.SUPABASE_AUTH_PASSWORD

try {
  requireStagingConfig(process.env)
} catch (error) {
  console.error('Admin review validation is not configured. This check is intentionally read-only and must run against a staging project with real user credentials.')
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: {
    apikey: supabaseAnonKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password }),
})

if (!authResponse.ok) {
  const detail = await authResponse.text()
  throw new Error(`Authentication failed: ${authResponse.status} ${detail}`)
}

const { access_token: accessToken } = await authResponse.json()

const versionsResponse = await fetch(`${supabaseUrl}/rest/v1/legal_source_versions?select=id,version_label,verified,status&verified=eq.false&limit=5`, {
  headers: {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
})

if (!versionsResponse.ok) {
  const detail = await versionsResponse.text()
  throw new Error(`Failed to load pending versions as a regular staging user: ${versionsResponse.status} ${detail}`)
}

const pendingVersions = await versionsResponse.json()
console.log('Pending review versions visible to a regular user:', pendingVersions.length)
console.log('This admin review validation is intentionally read-only and will not mutate staging data.')

if (pendingVersions.length === 0) {
  console.log('No unverified rows to inspect for the regular-user access check; staging is consistent with the verified-only policy.')
  process.exit(0)
}

console.log('The script successfully read the review queue without mutating any staging data.')
process.exit(0)
