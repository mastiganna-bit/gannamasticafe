import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { decryptHandoverCode } from '@/lib/server/handover'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser()
    const { id } = await context.params
    const admin = createAdminClient()
    const { data: order } = await admin.from('orders')
      .select('user_id,delivery_otp_ciphertext,delivery_otp_expires_at,delivery_status')
      .eq('id', id).eq('user_id', session.user.id).single()
    if (!order) throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND')
    if (!order.delivery_otp_ciphertext || !order.delivery_otp_expires_at || new Date(order.delivery_otp_expires_at) <= new Date()) {
      throw new ApiError(404, 'No active handover code is available.', 'CODE_UNAVAILABLE')
    }
    return NextResponse.json({ code: decryptHandoverCode(order.delivery_otp_ciphertext), expiresAt: order.delivery_otp_expires_at }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
