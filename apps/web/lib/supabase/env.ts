export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL. Set the public Supabase project URL before starting the app.'
    )
  }

  if (!anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Set the public Supabase anon key before starting the app.'
    )
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Supabase URL must use http or https.')
    }
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid http(s) URL.')
  }

  return { url, anonKey }
}
