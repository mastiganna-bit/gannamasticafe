import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Tell Next.js to NOT parse body (we need raw body for signature verification)
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-razorpay-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_secret'

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')

    if (!signature || signature.length !== expectedSignature.length) {
      console.error('Invalid signature length')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const isAuthentic = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    )

    if (!isAuthentic) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(rawBody)
    const supabase = createAdminClient()

    // Handle payment.captured event
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity
      const razorpayOrderId = payment.order_id

      // Check if already processed (idempotency)
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id, status')
        .eq('razorpay_order_id', razorpayOrderId)
        .single()

      if (existingOrder && existingOrder.status !== 'paid' && existingOrder.status !== 'completed') {
        await supabase
          .from('orders')
          .update({
            status: 'paid',
            razorpay_payment_id: payment.id,
          })
          .eq('razorpay_order_id', razorpayOrderId)
      }
    }

    // Handle order.paid event
    if (event.event === 'order.paid') {
      const order = event.payload.order.entity
      await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('razorpay_order_id', order.id)
        .neq('status', 'completed') // Don't downgrade completed orders
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
