import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DeliveryClientPage from '@/components/delivery/DeliveryClientPage'

export default async function DeliveryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/delivery')
  const { data: driverProfile } = await supabase.from('delivery_profiles').select('*').eq('user_id', user.id).single()
  if (!driverProfile?.is_approved) redirect('/account?notice=driver-approval-required')
  return <DeliveryClientPage initialDriver={driverProfile} />
}
