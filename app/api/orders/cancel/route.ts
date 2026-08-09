import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { createRazorpayRefund } from '@/lib/server/razorpay'
import { createAdminClient } from '@/lib/supabase/admin'
import { createOrderStatusNotification } from '@/lib/supabase/notifications'

const requestSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(3).max(300),
  items: z.array(z.object({ orderItemId: z.string().uuid(), quantity: z.number().int().min(1).max(25) })).max(40).optional(),
})

export async function POST(request: Request) {
  try {
    const session = await requireUser()
    const input = requestSchema.parse(await request.json())
    const admin = createAdminClient()
    const { data: order } = await admin.from('orders').select('*').eq('id', input.orderId).single()
    if (!order) throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND')
    const isAdmin = session.profile.is_admin || session.profile.role === 'admin'
    if (!isAdmin && order.user_id !== session.user.id) throw new ApiError(403, 'You cannot cancel this order.', 'FORBIDDEN')
    const customerAllowed = ['awaiting_payment', 'awaiting_acceptance']
    const adminAllowed = ['awaiting_payment', 'awaiting_acceptance', 'accepted', 'preparing', 'ready']
    if (!(isAdmin ? adminAllowed : customerAllowed).includes(order.fulfillment_status)) {
      throw new ApiError(409, 'This order can no longer be cancelled online. Please contact the cafe.', 'CANCELLATION_CLOSED')
    }

    const { data: orderItems } = await admin.from('order_items').select('*').eq('order_id', order.id)
    if (!orderItems?.length) throw new ApiError(409, 'Order item details are unavailable.', 'ORDER_ITEMS_MISSING')
    const requestedItems = input.items || []
    const fullCancellation = requestedItems.length === 0
    let amountPaise = order.total_paise
    const itemChanges = requestedItems.map((change) => {
      const item = orderItems.find((candidate) => candidate.id === change.orderItemId)
      if (!item || change.quantity > item.quantity - item.cancelled_quantity) {
        throw new ApiError(400, 'Invalid item cancellation quantity.', 'INVALID_CANCELLATION_ITEM')
      }
      amountPaise = 0
      return { ...change, reason: input.reason, amountPaise: (item.unit_price_paise + item.addon_total_paise) * change.quantity }
    })
    if (!fullCancellation) amountPaise = itemChanges.reduce((sum, item) => sum + item.amountPaise, 0)
    if (amountPaise <= 0 || amountPaise > order.total_paise) throw new ApiError(400, 'Invalid cancellation amount.', 'INVALID_CANCELLATION_AMOUNT')

    const { data: cancellation, error: cancellationError } = await admin.from('order_cancellations').insert({
      order_id: order.id,
      requested_by: session.user.id,
      reason: input.reason,
      item_changes: itemChanges,
      previous_fulfillment_status: order.fulfillment_status,
      full_cancellation: fullCancellation,
      amount_paise: amountPaise,
      status: 'processing',
    }).select('id').single()
    if (cancellationError || !cancellation) throw cancellationError || new Error('Cancellation could not be recorded.')

    const { data: reserved } = await admin.from('orders').update({
      fulfillment_status: 'cancellation_pending',
      cancelled_by: session.user.id,
      cancel_reason: input.reason,
      refund_status: order.payment_status === 'paid' ? 'processing' : 'none',
      updated_at: new Date().toISOString(),
    }).eq('id', order.id).eq('fulfillment_status', order.fulfillment_status).select('id').single()
    if (!reserved) throw new ApiError(409, 'The order changed before cancellation.', 'ORDER_CONFLICT')

    let refundId: string | null = null
    let refundState = 'none'
    try {
      if (order.payment_method === 'online' && order.payment_status === 'paid') {
        if (!order.razorpay_payment_id) throw new ApiError(409, 'Payment reference is unavailable.', 'PAYMENT_REFERENCE_MISSING')
        const refund = await createRazorpayRefund({
          paymentId: order.razorpay_payment_id,
          amountPaise,
          idempotencyKey: cancellation.id,
          reason: input.reason,
        })
        refundId = refund.id
        refundState = refund.status === 'processed' ? 'refunded' : 'pending'
      }

      const { error: finalizeError } = await admin.rpc('finalize_order_cancellation', {
        target_order_id: order.id,
        target_cancellation_id: cancellation.id,
        previous_fulfillment_status: order.fulfillment_status,
        full_cancellation: fullCancellation,
        cancelled_amount_paise: amountPaise,
        item_changes: itemChanges,
        refund_state: refundState,
        gateway_refund_id: refundId,
      })
      if (finalizeError) throw finalizeError
    } catch (error) {
      if (refundId) {
        // The gateway may already have moved money. Never reopen the order
        // automatically; leave it reserved for webhook/admin reconciliation.
        await admin.from('orders').update({ refund_status: refundState, refund_id: refundId, reconciliation_required: true }).eq('id', order.id).eq('fulfillment_status', 'cancellation_pending')
        await admin.from('order_cancellations').update({ status: 'processing', gateway_refund_id: refundId }).eq('id', cancellation.id)
      } else {
        await admin.from('orders').update({ fulfillment_status: order.fulfillment_status, refund_status: 'failed' }).eq('id', order.id).eq('fulfillment_status', 'cancellation_pending')
        await admin.from('order_cancellations').update({ status: 'failed', resolved_at: new Date().toISOString() }).eq('id', cancellation.id)
      }
      throw error
    }

    await admin.from('order_events').insert({
      order_id: order.id,
      event_type: fullCancellation ? 'order_cancelled' : 'items_cancelled',
      from_status: order.fulfillment_status,
      to_status: fullCancellation ? 'cancelled' : order.fulfillment_status,
      actor_id: session.user.id,
      actor_role: isAdmin ? 'admin' : 'customer',
      metadata: { cancellationId: cancellation.id, amountPaise, refundId, itemChanges },
    })
    if (fullCancellation) await createOrderStatusNotification(order.id, 'cancelled')
    return NextResponse.json({ success: true, fullCancellation, amountPaise, refundStatus: refundState })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
