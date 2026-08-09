import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { transitionOrder } from '@/lib/server/order-state'
import { createOrderStatusNotification } from '@/lib/supabase/notifications'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({ orderId: z.string().uuid(), action: z.enum(['accept', 'prepare', 'ready', 'complete']) })

export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    const { orderId, action } = schema.parse(await request.json())
    if (action === 'complete') {
      const { data: current } = await createAdminClient().from('orders').select('delivery_type').eq('id', orderId).single()
      if (current?.delivery_type === 'delivery') throw new ApiError(409, 'Delivery orders must be completed by the assigned driver using the handover code.', 'DRIVER_HANDOVER_REQUIRED')
    }
    const now = new Date().toISOString()
    const config = {
      accept: { from: ['awaiting_acceptance'], to: 'accepted', event: 'order_accepted', changes: { accepted_at: now, status: 'paid' } },
      prepare: { from: ['accepted'], to: 'preparing', event: 'preparation_started', changes: { status: 'preparing' } },
      ready: { from: ['preparing'], to: 'ready', event: 'order_ready', changes: { ready_at: now, status: 'completed' } },
      complete: { from: ['ready'], to: 'completed', event: 'customer_handover_completed', changes: { completed_at: now, status: 'completed' } },
    }[action]
    await transitionOrder({ orderId, allowedFrom: config.from, to: config.to, actorId: session.user.id, actorRole: 'admin', eventType: config.event, changes: config.changes })
    await createOrderStatusNotification(orderId, config.to)
    return NextResponse.json({ success: true })
  } catch (error) { return apiErrorResponse(error) }
}
