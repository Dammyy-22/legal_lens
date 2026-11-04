import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/DashboardShell'
import { getServerAdminAccess } from '@/lib/admin-access'

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

  const fullName = (user.user_metadata?.full_name as string | undefined) ?? null
  const adminAccess = getServerAdminAccess(user, 'reviewer')

  return (
    <DashboardShell
      user={{
        fullName,
        email: user.email ?? null,
        isAdmin: adminAccess.allowed,
        adminRole: adminAccess.highestRole,
      }}
    >
      {children}
    </DashboardShell>
  )
}
