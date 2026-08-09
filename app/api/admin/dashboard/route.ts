import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { apiErrorResponse } from '@/lib/server/errors'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    await requireAdmin()
    const admin = createAdminClient()
    const [{ data: orders, error: orderError }, { data: driverRows, error: driverError }] = await Promise.all([
      admin.from('orders').select('*,order_items(*)').order('created_at', { ascending: false }).limit(250),
      admin.from('delivery_profiles').select('*').order('created_at', { ascending: false }),
    ])
    if (orderError) throw orderError
    if (driverError) throw driverError
    const ids = (driverRows || []).map((driver) => driver.user_id)
    const { data: profiles } = ids.length ? await admin.from('profiles').select('id,full_name,phone').in('id', ids) : { data: [] }
    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]))
    const drivers = (driverRows || []).map((driver) => ({ ...driver, profile: profileMap.get(driver.user_id) || null }))
    return NextResponse.json({ orders: orders || [], drivers }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return apiErrorResponse(error) }
}
