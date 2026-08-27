import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client — safe to use in 'use client' components. Uses the
// anon/publishable key only, which is meant to be public (RLS policies in Supabase
// enforce real authorization, not this key).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
