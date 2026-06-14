import { createClient } from '@/lib/supabase/server'
import AdminDashboard from '@/components/admin/AdminDashboard'

export const metadata = { title: 'Admin — Gannamasti Cafe' }

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .or('status.in.(paid,preparing),and(delivery_type.eq.delivery,delivery_status.neq.delivered)')
    .order('created_at', { ascending: false })

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: completedToday } = await supabase
    .from('orders')
    .select('id, total_paise')
    .eq('status', 'completed')
    .gte('created_at', todayStart.toISOString())

  return (
    <AdminDashboard
      initialOrders={orders || []}
      completedToday={completedToday || []}
    />
  )
}
