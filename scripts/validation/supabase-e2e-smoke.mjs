import process from 'node:process'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const email = process.env.SUPABASE_AUTH_EMAIL
const password = process.env.SUPABASE_AUTH_PASSWORD

if (!supabaseUrl || !supabaseAnonKey || !email || !password) {
  console.log('Supabase smoke test not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_AUTH_EMAIL, and SUPABASE_AUTH_PASSWORD.')
  process.exit(0)
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

const authData = await authResponse.json()
const accessToken = authData.access_token

const askResponse = await fetch(`${supabaseUrl}/functions/v1/ask`, {
  method: 'POST',
  headers: {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ question: 'What legal rights do I have if I am stopped by the police in Nigeria?' }),
})

const askText = await askResponse.text()
console.log('Ask response status:', askResponse.status)
console.log(askText.slice(0, 500))

if (!askResponse.ok) {
  throw new Error(`Ask endpoint returned ${askResponse.status}: ${askText}`)
}

const legalResponse = await fetch(`${supabaseUrl}/functions/v1/legal?mode=search&q=police%20rights&limit=3`, {
  method: 'GET',
  headers: {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
  },
})

const legalText = await legalResponse.text()
console.log('Legal response status:', legalResponse.status)
console.log(legalText.slice(0, 500))

if (!legalResponse.ok) {
  throw new Error(`Legal endpoint returned ${legalResponse.status}: ${legalText}`)
}
