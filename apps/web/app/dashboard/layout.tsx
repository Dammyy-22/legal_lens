import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/DashboardShell'

// Applies to every route under /dashboard/*. Middleware already protects this path,
// but a layout should never assume a client-side or edge guard ran — fetch the real
// session here too.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return <DashboardShell email={user.email ?? ''}>{children}</DashboardShell>
}
