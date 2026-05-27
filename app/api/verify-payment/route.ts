import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = await request.json()

    const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'

    // Cryptographic signature verification
    const body = `${razorpay_order_id}|${razorpay_payment_id}`
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')

    if (!razorpay_signature || razorpay_signature.length !== expectedSignature.length) {
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 400 })
    }

    const isAuthentic = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(razorpay_signature, 'hex')
    )

    if (!isAuthentic) {
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 400 })
    }

    // Update order status to 'paid'
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        razorpay_payment_id,
      })
      .eq('razorpay_order_id', razorpay_order_id)

    if (error) {
      console.error('DB update error:', error)
      return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Verify payment error:', error)
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 })
  }
}
