import { describe, expect, it } from 'vitest'
import { canAdminCancelOrder } from '@/lib/admin-order-actions'

describe('admin order actions', () => {
  it('allows rejection before a delivery partner is assigned', () => {
    expect(canAdminCancelOrder({
      fulfillment_status: 'ready',
      delivery_type: 'delivery',
      delivery_status: 'unassigned',
    })).toBe(true)
  })

  it('removes rejection after a delivery partner is assigned', () => {
    expect(canAdminCancelOrder({
      fulfillment_status: 'ready',
      delivery_type: 'delivery',
      delivery_status: 'assigned',
    })).toBe(false)
  })

  it('does not expose rejection for terminal orders', () => {
    expect(canAdminCancelOrder({
      fulfillment_status: 'cancelled',
      delivery_type: 'takeaway',
      delivery_status: 'delivered',
    })).toBe(false)
  })
})
