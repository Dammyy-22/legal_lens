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
  const userName = (user.user_metadata?.username as string | undefined)
    ?? (user.user_metadata?.nickname as string | undefined)
    ?? null
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null
  const adminAccess = getServerAdminAccess(user, 'reviewer')

  return (
    <DashboardShell
      user={{
        fullName,
        userName,
        avatarUrl,
        email: user.email ?? null,
        isAdmin: adminAccess.allowed,
        adminRole: adminAccess.highestRole,
      }}
    >
      {children}
    </DashboardShell>
  )
}
