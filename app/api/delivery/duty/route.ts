import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { createAdminClient } from '@/lib/supabase/admin'

const requestSchema = z.object({ active: z.boolean() })

export async function POST(request: Request) {
  try {
    const session = await requireUser()
    const { active } = requestSchema.parse(await request.json())
    const admin = createAdminClient()
    if (!active) {
      const { count } = await admin.from('orders').select('id', { count: 'exact', head: true }).eq('delivery_boy_id', session.user.id).in('fulfillment_status', ['ready', 'picked_up'])
      if (count) throw new ApiError(409, 'Complete or reassign your active delivery before going off duty.', 'ACTIVE_DELIVERY_EXISTS')
    }
    const { data, error } = await admin.from('delivery_profiles').update({ is_active: active, updated_at: new Date().toISOString() })
      .eq('user_id', session.user.id).eq('is_approved', true).select('user_id').single()
    if (error || !data) throw new ApiError(403, 'Approved delivery-partner access required.', 'DRIVER_REQUIRED')
    return NextResponse.json({ success: true, active })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
