import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { encryptHandoverCode, generateHandoverCode, hashHandoverCode } from '@/lib/server/handover'
import { createAdminClient } from '@/lib/supabase/admin'

const requestSchema = z.object({ orderId: z.string().uuid(), driverId: z.string().uuid() })

export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    const { orderId, driverId } = requestSchema.parse(await request.json())
    const admin = createAdminClient()
    const { data: driver } = await admin.from('delivery_profiles')
      .select('user_id').eq('user_id', driverId).eq('is_active', true).eq('is_approved', true).single()
    if (!driver) throw new ApiError(400, 'Select an approved active delivery partner.', 'INVALID_DRIVER')

    const code = generateHandoverCode()
    const { data: order, error } = await admin.from('orders').update({
      delivery_boy_id: driverId,
      delivery_status: 'assigned',
      assigned_at: new Date().toISOString(),
      delivery_otp_hash: hashHandoverCode(code),
      delivery_otp_ciphertext: encryptHandoverCode(code),
      delivery_otp_expires_at: new Date(Date.now() + 4 * 60 * 60_000).toISOString(),
      delivery_otp_attempts: 0,
    }).eq('id', orderId)
      .eq('delivery_type', 'delivery')
      .eq('fulfillment_status', 'ready')
      .eq('delivery_status', 'unassigned')
      .select('id')
      .single()
    if (error || !order) throw new ApiError(409, 'Order is not ready or has already been assigned.', 'ASSIGNMENT_CONFLICT')

    await admin.from('order_events').insert({
      order_id: orderId,
      event_type: 'driver_assigned',
      actor_id: session.user.id,
      actor_role: 'admin',
      metadata: { driverId },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
