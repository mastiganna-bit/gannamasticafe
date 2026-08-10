import { createAdminClient } from '@/lib/supabase/admin'
import { ApiError } from './errors'

export async function transitionOrder(input: {
  orderId: string
  allowedFrom: string[]
  to: string
  actorId: string
  actorRole: string
  changes?: Record<string, unknown>
  eventType?: string
}) {
  const admin = createAdminClient()
  const { data: current } = await admin.from('orders')
    .select('id,fulfillment_status,payment_status,payment_method,delivery_type')
    .eq('id', input.orderId)
    .single()
  if (!current) throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND')
  if (!input.allowedFrom.includes(current.fulfillment_status)) {
    throw new ApiError(409, `Order cannot move from ${current.fulfillment_status} to ${input.to}.`, 'INVALID_ORDER_TRANSITION')
  }

  const { data: updated, error } = await admin.from('orders').update({
    fulfillment_status: input.to,
    updated_at: new Date().toISOString(),
    ...input.changes,
  }).eq('id', input.orderId)
    .eq('fulfillment_status', current.fulfillment_status)
    .select('id,fulfillment_status,payment_status,payment_method,delivery_type')
    .single()
  if (error || !updated) throw new ApiError(409, 'The order changed while this action was being processed.', 'ORDER_CONFLICT')

  await admin.from('order_events').insert({
    order_id: input.orderId,
    event_type: input.eventType || 'status_changed',
    from_status: current.fulfillment_status,
    to_status: input.to,
    actor_id: input.actorId,
    actor_role: input.actorRole,
  })
  return updated
}
