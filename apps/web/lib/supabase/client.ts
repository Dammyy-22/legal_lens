import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublicEnv } from './env'

// Browser-side Supabase client — safe to use in 'use client' components. Uses the
// anon/publishable key only, which is meant to be public (RLS policies in Supabase
// enforce real authorization, not this key).
export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv()
  return createBrowserClient(url, anonKey)
}
