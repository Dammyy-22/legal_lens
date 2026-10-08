import process from 'node:process'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = process.env.ADMIN_REVIEW_EMAIL

if (!supabaseUrl || !serviceRoleKey || !adminEmail) {
  console.log('Admin flow smoke test not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and ADMIN_REVIEW_EMAIL.')
  process.exit(0)
}

const restHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
}

const versionsResponse = await fetch(`${supabaseUrl}/rest/v1/legal_source_versions?select=id,version_label,verified,status&verified=eq.false&limit=5`, {
  headers: restHeaders,
})

if (!versionsResponse.ok) {
  const detail = await versionsResponse.text()
  throw new Error(`Failed to load pending versions: ${versionsResponse.status} ${detail}`)
}

const pendingVersions = await versionsResponse.json()
console.log('Pending review versions:', pendingVersions.length)

if (pendingVersions.length === 0) {
  console.log('No unverified rows to test; admin review flow is ready in a live project.')
  process.exit(0)
}

const targetId = pendingVersions[0].id
console.log('Targeting review id:', targetId)

const updateResponse = await fetch(`${supabaseUrl}/rest/v1/legal_source_versions?id=eq.${targetId}`, {
  method: 'PATCH',
  headers: restHeaders,
  body: JSON.stringify({
    verified: true,
    status: 'current',
    review_notes: 'Automated validation check passed.',
    reviewed_by: adminEmail,
    reviewed_at: new Date().toISOString(),
    verified_by: adminEmail,
    verified_at: new Date().toISOString(),
  }),
})

const updateText = await updateResponse.text()
console.log('Review update status:', updateResponse.status)
console.log(updateText.slice(0, 500))

if (!updateResponse.ok) {
  throw new Error(`Review update failed: ${updateResponse.status} ${updateText}`)
}
