import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DeliveryClientPage from '@/components/delivery/DeliveryClientPage'

export default async function DeliveryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/delivery')
  }

  // Fetch driver profile from delivery_profiles
  const { data: driverProfile } = await supabase
    .from('delivery_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Fetch active/unassigned ready orders
  const { data: unassignedOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('delivery_type', 'delivery')
    .eq('status', 'completed') // 'completed' means kitchen finished preparing it
    .eq('delivery_status', 'unassigned')
    .order('created_at', { ascending: false })

  // Fetch assigned active orders for this driver
  const { data: activeOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('delivery_boy_id', user.id)
    .neq('delivery_status', 'delivered')
    .order('created_at', { ascending: false })

  // Fetch past delivered orders by this driver today
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { data: completedOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('delivery_boy_id', user.id)
    .eq('delivery_status', 'delivered')
    .gte('updated_at', startOfDay.toISOString())
    .order('updated_at', { ascending: false })

  return (
    <DeliveryClientPage
      user={user}
      driverProfile={driverProfile}
      initialUnassigned={unassignedOrders || []}
      initialActive={activeOrders || []}
      initialCompleted={completedOrders || []}
    />
  )
}
