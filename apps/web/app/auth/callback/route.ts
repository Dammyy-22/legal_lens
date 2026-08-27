import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Supabase's OAuth flow (Google, etc.) redirects the browser here with a `code` query
// param after the provider confirms the user's identity. This route exchanges that
// code for a real session and sets the session cookie — without this, the OAuth
// flow completes on Google/Supabase's side but the browser never actually gets logged
// into this app.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // No code, or the exchange failed — send the user back to login with a visible
  // reason rather than silently landing on a broken page.
  return NextResponse.redirect(`${origin}/auth/login?error=oauth_callback_failed`)
}
