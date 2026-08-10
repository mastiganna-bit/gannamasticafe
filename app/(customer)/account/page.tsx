import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AccountClientPage from '@/components/account/AccountClientPage'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('*,order_items(*),reviews(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: addresses } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <AccountClientPage
      orders={orders || []}
      notifications={notifications || []}
      profile={profile}
      addresses={addresses || []}
    />
  )
}
