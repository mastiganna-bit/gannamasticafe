import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/server/auth'
import { apiErrorResponse } from '@/lib/server/errors'
import { addressSchema } from '@/lib/server/validation'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const session = await requireUser()
    const admin = createAdminClient()
    const { data, error } = await admin.from('customer_addresses').select('*')
      .eq('user_id', session.user.id).order('is_default', { ascending: false }).order('created_at')
    if (error) throw error
    return NextResponse.json({ addresses: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
export async function POST(request: Request) {
  try {
    const session = await requireUser()
    const input = addressSchema.parse(await request.json())
    const admin = createAdminClient()
    if (input.isDefault) await admin.from('customer_addresses').update({ is_default: false }).eq('user_id', session.user.id)
    const { data, error } = await admin.from('customer_addresses').insert({
      user_id: session.user.id,
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
    }).select('*').single()
    if (error || !data) throw error || new Error('Address could not be saved.')
    return NextResponse.json({ address: data }, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
