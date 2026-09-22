import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminCorpusReview from './AdminCorpusReview'

// UX-level gate only — the REAL enforcement is Row Level Security in
// database/schema.sql (verified directly against Postgres: a non-admin's UPDATE
// affects 0 rows, a non-admin's SELECT on unverified content returns 0 rows). This
// redirect just avoids showing a non-admin an empty page; it grants no actual access.
export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const isAdmin = user.app_metadata?.role === 'admin'
  if (!isAdmin) {
    redirect('/dashboard')
  }

  return <AdminCorpusReview />
}
