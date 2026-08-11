import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { createAdminClient } from '@/lib/supabase/admin'

const requestSchema = z.object({
  driverId: z.string().uuid(),
  approved: z.boolean(),
})

export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    const input = requestSchema.parse(await request.json())
    const admin = createAdminClient()

    const { data: driver, error: driverError } = await admin.from('delivery_profiles')
      .select('user_id,is_approved')
      .eq('user_id', input.driverId)
      .single()
    if (driverError || !driver) throw new ApiError(404, 'Delivery partner not found.', 'DRIVER_NOT_FOUND')

    if (!input.approved) {
      const { count, error: assignmentError } = await admin.from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('delivery_boy_id', input.driverId)
        .in('fulfillment_status', ['ready', 'picked_up'])
      if (assignmentError) throw assignmentError
      if ((count || 0) > 0) {
        throw new ApiError(409, 'Reassign or complete this partner’s active deliveries before suspending the account.', 'DRIVER_HAS_ACTIVE_ORDERS')
      }
    }

    const { error } = await admin.from('delivery_profiles').update({
      is_approved: input.approved,
      is_active: false,
      approved_by: input.approved ? session.user.id : null,
      approved_at: input.approved ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('user_id', input.driverId)
    if (error) throw error

    return NextResponse.json({ success: true, approved: input.approved })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
