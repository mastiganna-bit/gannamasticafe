import crypto from 'crypto'
import { after, NextResponse } from 'next/server'
import { requireServerEnv } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { createOrderStatusNotification } from '@/lib/supabase/notifications'
import { createRazorpayRefund } from '@/lib/server/razorpay'

type RazorpayEntity = {
  id?: string
  order_id?: string
  payment_id?: string
  amount?: number
  currency?: string
  status?: string
}

type RazorpayEvent = {
  event: string
  payload?: {
    payment?: { entity?: RazorpayEntity }
    order?: { entity?: RazorpayEntity }
    refund?: { entity?: RazorpayEntity }
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature') || ''
  const eventId = request.headers.get('x-razorpay-event-id') || ''
  if (!signature || !eventId || !/^[a-f0-9]{64}$/i.test(signature)) {
    return NextResponse.json({ error: 'Invalid webhook headers' }, { status: 400 })
  }

  const expected = crypto.createHmac('sha256', requireServerEnv('RAZORPAY_WEBHOOK_SECRET')).update(rawBody).digest('hex')
  if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: RazorpayEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const admin = createAdminClient()
  const payment = event.payload?.payment?.entity
  const gatewayOrderId = payment?.order_id || event.payload?.order?.entity?.id
  const { error: claimError } = await admin.from('payment_events').insert({
    id: eventId,
    event_type: event.event,
    razorpay_order_id: gatewayOrderId || null,
    razorpay_payment_id: payment?.id || event.payload?.refund?.entity?.payment_id || null,
    payload: event,
    status: 'received',
  })
  if (claimError?.code === '23505') return NextResponse.json({ status: 'duplicate' })
  if (claimError) return NextResponse.json({ error: 'Event could not be recorded' }, { status: 500 })

  after(async () => processEvent(eventId, event))
  return NextResponse.json({ status: 'accepted' })
}

async function processEvent(eventId: string, event: RazorpayEvent) {
  const admin = createAdminClient()
  try {
    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity
      if (!payment?.id || !payment.order_id) throw new Error('Missing payment identifiers')
      const { data: order } = await admin.from('orders')
        .select('id,total_paise,payment_status,fulfillment_status')
        .eq('razorpay_order_id', payment.order_id)
        .single()
      if (!order) throw new Error('Order not found')
      if (Number(payment.amount) !== order.total_paise || payment.currency !== 'INR') throw new Error('Payment amount mismatch')

      if (['cancelled', 'rejected', 'payment_failed'].includes(order.fulfillment_status)) {
        await admin.from('orders').update({
          razorpay_payment_id: payment.id,
          payment_status: 'paid',
          refund_status: 'pending',
          reconciliation_required: true,
        }).eq('id', order.id)
        await admin.from('order_events').insert({
          order_id: order.id,
          event_type: 'late_payment_requires_refund',
          actor_role: 'system',
          metadata: { paymentId: payment.id, eventId },
        })
        const refund = await createRazorpayRefund({ paymentId: payment.id, amountPaise: order.total_paise, idempotencyKey: `late-${eventId}`, reason: 'Payment captured after order closure' })
        await admin.from('orders').update({ refund_id: refund.id, refund_status: refund.status === 'processed' ? 'refunded' : 'pending', reconciliation_required: refund.status !== 'processed' }).eq('id', order.id)
      } else if (order.payment_status !== 'paid') {
        const { data: updated } = await admin.from('orders').update({
          razorpay_payment_id: payment.id,
          payment_status: 'paid',
          fulfillment_status: 'awaiting_acceptance',
          status: 'paid',
          updated_at: new Date().toISOString(),
        }).eq('id', order.id).eq('fulfillment_status', 'awaiting_payment').select('id').maybeSingle()
        if (updated) {
          await admin.from('order_events').insert({
            order_id: order.id,
            event_type: 'payment_captured',
            from_status: 'awaiting_payment',
            to_status: 'awaiting_acceptance',
            actor_role: 'system',
            metadata: { paymentId: payment.id, eventId },
          })
          await createOrderStatusNotification(order.id, 'paid')
        }
      }
    } else if (event.event === 'payment.failed') {
      const payment = event.payload?.payment?.entity
      if (payment?.order_id) {
        await admin.from('orders').update({ payment_status: 'failed', fulfillment_status: 'payment_failed', status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('razorpay_order_id', payment.order_id).eq('payment_status', 'pending')
      }
    } else if (event.event === 'refund.processed') {
      const refund = event.payload?.refund?.entity
      if (refund?.payment_id) {
        const { data: order } = await admin.from('orders').update({ refund_status: 'refunded', payment_status: 'refunded', refund_id: refund.id || null, reconciliation_required: false })
          .eq('razorpay_payment_id', refund.payment_id).select('id,fulfillment_status').single()
        if (order?.fulfillment_status === 'cancellation_pending') {
          const { data: cancellation } = await admin.from('order_cancellations').select('*').eq('order_id', order.id).eq('status', 'processing').order('created_at', { ascending: false }).limit(1).maybeSingle()
          if (cancellation) await admin.rpc('finalize_order_cancellation', {
            target_order_id: order.id, target_cancellation_id: cancellation.id,
            previous_fulfillment_status: cancellation.previous_fulfillment_status,
            full_cancellation: cancellation.full_cancellation,
            cancelled_amount_paise: cancellation.amount_paise,
            item_changes: cancellation.item_changes,
            refund_state: 'refunded', gateway_refund_id: refund.id || null,
          })
        }
      }
    } else if (event.event === 'refund.failed') {
      const refund = event.payload?.refund?.entity
      if (refund?.payment_id) {
        await admin.from('orders').update({ refund_status: 'failed', refund_id: refund.id || null })
          .eq('razorpay_payment_id', refund.payment_id)
      }
    } else if (event.event === 'payment.dispute.created') {
      const payment = event.payload?.payment?.entity
      if (payment?.id) await admin.from('orders').update({ payment_status: 'disputed' }).eq('razorpay_payment_id', payment.id)
    }

    await admin.from('payment_events').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('id', eventId)
  } catch (error) {
    await admin.from('payment_events').update({
      status: 'failed',
      error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown processing error',
      processed_at: new Date().toISOString(),
    }).eq('id', eventId)
  }
}
