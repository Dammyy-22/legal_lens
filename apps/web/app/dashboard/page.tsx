import { createClient } from '@/lib/supabase/server'
import DashboardOverview from './DashboardOverview'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? null

  return <DashboardOverview fullName={fullName} />
}
