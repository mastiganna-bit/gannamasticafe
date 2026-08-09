import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({ orderId: z.string().uuid(), rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() })

export async function POST(request: Request) {
  try {
    const session = await requireUser()
    const input = schema.parse(await request.json())
    const admin = createAdminClient()
    const { data: order } = await admin.from('orders').select('id,user_id,fulfillment_status').eq('id', input.orderId).single()
    if (!order || order.user_id !== session.user.id) throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND')
    if (!['completed', 'delivered'].includes(order.fulfillment_status)) throw new ApiError(409, 'You can review an order after it is completed.', 'ORDER_NOT_COMPLETE')
    const { data: existing } = await admin.from('reviews').select('id').eq('order_id', order.id).eq('user_id', session.user.id).maybeSingle()
    const payload = { order_id: order.id, user_id: session.user.id, rating: input.rating, comment: input.comment || null, is_published: true, updated_at: new Date().toISOString() }
    const { error } = existing
      ? await admin.from('reviews').update(payload).eq('id', existing.id).eq('user_id', session.user.id)
      : await admin.from('reviews').insert(payload)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) { return apiErrorResponse(error) }
}
