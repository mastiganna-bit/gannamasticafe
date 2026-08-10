import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const session = await requireUser()
    const admin = createAdminClient()
    const { data: driver } = await admin.from('delivery_profiles').select('*').eq('user_id', session.user.id).eq('is_approved', true).single()
    if (!driver) throw new ApiError(403, 'Approved delivery-partner access required.', 'DRIVER_REQUIRED')
    const { data: orders, error } = await admin.from('orders').select('*,order_items(*)').eq('delivery_boy_id', session.user.id).order('created_at', { ascending: false }).limit(100)
    if (error) throw error
    return NextResponse.json({ driver, orders: orders || [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return apiErrorResponse(error) }
}
