import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/DashboardShell'

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
  const isAdmin = user.app_metadata?.role === 'admin'

  return (
    <DashboardShell user={{ fullName, email: user.email ?? null, isAdmin }}>
      {children}
    </DashboardShell>
  )
}
