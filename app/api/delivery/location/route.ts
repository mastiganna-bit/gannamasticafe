import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApprovedDriver } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({ orderId: z.string().uuid(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().nonnegative().max(10_000).optional() })
export async function POST(request: Request) {
  try {
    const session = await requireApprovedDriver()
    const input = schema.parse(await request.json())
    const admin = createAdminClient()
    const { data: order } = await admin.from('orders').select('id').eq('id', input.orderId).eq('delivery_boy_id', session.user.id).in('fulfillment_status', ['ready','picked_up']).single()
    if (!order) throw new ApiError(403, 'This delivery is not assigned to you.', 'ASSIGNMENT_REQUIRED')
    const { error } = await admin.from('delivery_locations').upsert({ order_id: order.id, delivery_boy_id: session.user.id, latitude: input.latitude, longitude: input.longitude, accuracy: input.accuracy || null, updated_at: new Date().toISOString() }, { onConflict: 'order_id' })
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) { return apiErrorResponse(error) }
}
