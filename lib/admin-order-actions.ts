const cancellableStatuses = new Set([
  'awaiting_payment',
  'awaiting_acceptance',
  'accepted',
  'preparing',
  'ready',
])

export function canAdminCancelOrder(order: {
  fulfillment_status: string
  delivery_type: string
  delivery_status: string
}) {
  if (!cancellableStatuses.has(order.fulfillment_status)) return false
  return order.delivery_type !== 'delivery' || order.delivery_status === 'unassigned'
}
