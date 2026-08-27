import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

// Server component: the middleware already redirects unauthenticated requests away
// from /dashboard, but we still fetch the user here (not just trust the redirect
// happened) so the page has real data to render, not a client-side loading flash.
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Belt-and-suspenders: middleware should have already redirected, but a server
  // component should never assume a client-side guard ran.
  if (!user) {
    return null
  }

  return <DashboardClient email={user.email ?? ''} />
}
