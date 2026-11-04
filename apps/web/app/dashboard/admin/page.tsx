import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerAdminAccess } from '@/lib/admin-access'
import AdminCorpusReview from './AdminCorpusReview'

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const adminAccess = getServerAdminAccess(user, 'reviewer')
  if (!adminAccess.allowed) {
    redirect('/dashboard')
  }

  return <AdminCorpusReview adminRole={adminAccess.highestRole} />
}
