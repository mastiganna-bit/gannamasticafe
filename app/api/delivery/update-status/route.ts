import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApprovedDriver } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { hashHandoverCode } from '@/lib/server/handover'
import { createAdminClient } from '@/lib/supabase/admin'
import { createOrderStatusNotification } from '@/lib/supabase/notifications'

const requestSchema = z.object({
  orderId: z.string().uuid(),
  action: z.enum(['pickup', 'deliver']),
  otp: z.string().regex(/^\d{6}$/).optional(),
})

export async function POST(request: Request) {
  try {
    const session = await requireApprovedDriver()
    const input = requestSchema.parse(await request.json())
    const admin = createAdminClient()
    const { data: order } = await admin.from('orders').select('*')
      .eq('id', input.orderId).eq('delivery_boy_id', session.user.id).single()
    if (!order) throw new ApiError(404, 'Assigned order not found.', 'ORDER_NOT_FOUND')

    if (input.action === 'pickup') {
      if (order.fulfillment_status !== 'ready' || order.delivery_status !== 'assigned') {
        throw new ApiError(409, 'This order is not ready for pickup.', 'INVALID_ORDER_TRANSITION')
      }
      const { data: updated } = await admin.from('orders').update({
        fulfillment_status: 'picked_up', delivery_status: 'picked_up', updated_at: new Date().toISOString(),
      }).eq('id', order.id).eq('fulfillment_status', 'ready').eq('delivery_status', 'assigned').select('id').single()
      if (!updated) throw new ApiError(409, 'The order changed before pickup.', 'ORDER_CONFLICT')
      await admin.from('order_events').insert({ order_id: order.id, event_type: 'picked_up', from_status: 'ready', to_status: 'picked_up', actor_id: session.user.id, actor_role: 'driver' })
      await createOrderStatusNotification(order.id, 'picked_up')
      return NextResponse.json({ success: true })
    }

    if (!input.otp) throw new ApiError(400, 'Enter the customer’s 6-digit handover code.', 'OTP_REQUIRED')
    if (order.fulfillment_status !== 'picked_up' || order.delivery_status !== 'picked_up') {
      throw new ApiError(409, 'This order is not out for delivery.', 'INVALID_ORDER_TRANSITION')
    }
    if (!order.delivery_otp_expires_at || new Date(order.delivery_otp_expires_at) <= new Date() || order.delivery_otp_attempts >= 5) {
      throw new ApiError(409, 'The handover code is expired or locked. Contact the cafe.', 'OTP_LOCKED')
    }
    const supplied = Buffer.from(hashHandoverCode(input.otp), 'hex')
    const expected = Buffer.from(order.delivery_otp_hash || '', 'hex')
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      await admin.from('orders').update({ delivery_otp_attempts: order.delivery_otp_attempts + 1 }).eq('id', order.id)
      throw new ApiError(400, 'Incorrect handover code.', 'INVALID_OTP')
    }

    const { data: delivered } = await admin.from('orders').update({
      fulfillment_status: 'delivered',
      delivery_status: 'delivered',
      status: 'completed',
      completed_at: new Date().toISOString(),
      delivery_otp_hash: null,
      delivery_otp_ciphertext: null,
      delivery_otp_expires_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id).eq('fulfillment_status', 'picked_up').select('id').single()
    if (!delivered) throw new ApiError(409, 'The order changed before delivery confirmation.', 'ORDER_CONFLICT')
    await admin.from('delivery_locations').delete().eq('order_id', order.id)
    await admin.from('order_events').insert({ order_id: order.id, event_type: 'delivered', from_status: 'picked_up', to_status: 'delivered', actor_id: session.user.id, actor_role: 'driver' })
    await createOrderStatusNotification(order.id, 'delivered')
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
