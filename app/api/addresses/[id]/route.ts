import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { addressSchema } from '@/lib/server/validation'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser()
    const { id } = await context.params
    const input = addressSchema.parse(await request.json())
    const admin = createAdminClient()
    if (input.isDefault) await admin.from('customer_addresses').update({ is_default: false }).eq('user_id', session.user.id)
    const { data, error } = await admin.from('customer_addresses').update({
      label: input.label,
      recipient_name: input.recipientName,
      phone: input.phone,
      house: input.house,
      area: input.area,
      landmark: input.landmark || null,
      city: input.city,
      postal_code: input.postalCode || null,
      latitude: input.latitude,
      longitude: input.longitude,
      is_default: input.isDefault,
      updated_at: new Date().toISOString(),
    }).eq('id', id).eq('user_id', session.user.id).select('*').single()
    if (error || !data) throw new ApiError(404, 'Address not found.', 'ADDRESS_NOT_FOUND')
    return NextResponse.json({ address: data })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser()
    const { id } = await context.params
    const admin = createAdminClient()
    const { count } = await admin.from('customer_addresses').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id)
    if ((count || 0) <= 1) throw new ApiError(409, 'Keep at least one saved address.', 'LAST_ADDRESS')
    const { error } = await admin.from('customer_addresses').delete().eq('id', id).eq('user_id', session.user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
