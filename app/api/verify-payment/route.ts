import crypto from 'crypto'
import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { z } from 'zod'
import { requireServerEnv } from '@/lib/env'
import { requireUser } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { createOrderStatusNotification } from '@/lib/supabase/notifications'

const requestSchema = z.object({
  orderId: z.string().uuid(),
  razorpayOrderId: z.string().min(8).max(100),
  razorpayPaymentId: z.string().min(8).max(100),
  razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/i),
})

export async function POST(request: Request) {
  try {
    const session = await requireUser()
    const input = requestSchema.parse(await request.json())
    const admin = createAdminClient()
    const { data: order } = await admin.from('orders')
      .select('id,user_id,razorpay_order_id,razorpay_payment_id,total_paise,payment_status,fulfillment_status')
      .eq('id', input.orderId)
      .eq('user_id', session.user.id)
      .single()
    if (!order) throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND')
    if (order.payment_status === 'paid' && order.razorpay_payment_id === input.razorpayPaymentId) {
      return NextResponse.json({ success: true, idempotentReplay: true })
    }
    if (order.fulfillment_status !== 'awaiting_payment' || order.payment_status !== 'pending') {
      throw new ApiError(409, 'This order can no longer accept a payment.', 'INVALID_ORDER_STATE')
    }
    if (!order.razorpay_order_id || order.razorpay_order_id !== input.razorpayOrderId) {
      throw new ApiError(400, 'Payment does not match this order.', 'PAYMENT_MISMATCH')
    }

    const secret = requireServerEnv('RAZORPAY_KEY_SECRET')
    const expected = crypto.createHmac('sha256', secret)
      .update(`${order.razorpay_order_id}|${input.razorpayPaymentId}`)
      .digest('hex')
    const authentic = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(input.razorpaySignature, 'hex'))
    if (!authentic) throw new ApiError(400, 'Payment verification failed.', 'INVALID_SIGNATURE')

    const razorpay = new Razorpay({ key_id: requireServerEnv('RAZORPAY_KEY_ID'), key_secret: secret })
    const payment = await razorpay.payments.fetch(input.razorpayPaymentId)
    if (
      payment.order_id !== order.razorpay_order_id ||
      payment.status !== 'captured' ||
      Number(payment.amount) !== order.total_paise ||
      payment.currency !== 'INR'
    ) {
      throw new ApiError(409, 'Payment has not been captured for the correct amount.', 'PAYMENT_NOT_CAPTURED')
    }

    const { data: updated, error } = await admin.from('orders').update({
      razorpay_payment_id: input.razorpayPaymentId,
      payment_status: 'paid',
      fulfillment_status: 'awaiting_acceptance',
      status: 'paid',
      updated_at: new Date().toISOString(),
    })
      .eq('id', order.id)
      .eq('payment_status', 'pending')
      .eq('fulfillment_status', 'awaiting_payment')
      .select('id')
      .single()
    if (error || !updated) throw new ApiError(409, 'Payment was already processed or the order changed.', 'PAYMENT_CONFLICT')

    await admin.from('order_events').insert({
      order_id: order.id,
      event_type: 'payment_captured',
      from_status: 'awaiting_payment',
      to_status: 'awaiting_acceptance',
      actor_id: session.user.id,
      actor_role: 'customer',
      metadata: { razorpayPaymentId: input.razorpayPaymentId },
    })
    await createOrderStatusNotification(order.id, 'paid')
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
