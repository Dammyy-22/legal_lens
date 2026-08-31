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

  return (
    <DashboardShell user={{ fullName, email: user.email ?? null }}>
      {children}
    </DashboardShell>
  )
}
