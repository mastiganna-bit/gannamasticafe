import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { verifyOtpChallenge } from '@/lib/server/otp'
import { addressSchema, indianPhoneSchema, passwordSchema } from '@/lib/server/validation'

const requestSchema = z.object({
  challengeId: z.string().uuid(),
  otp: z.string().regex(/^\d{4,8}$/),
  phone: indianPhoneSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2).max(80),
  address: addressSchema,
})

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json())
    await verifyOtpChallenge({
      challengeId: input.challengeId,
      phone: input.phone,
      purpose: 'signup',
      code: input.otp,
    })

    const admin = createAdminClient()
    const { data: existing } = await admin.from('profiles').select('id').eq('phone', input.phone).maybeSingle()
    if (existing) throw new ApiError(409, 'An account already exists. Please log in or reset your password.', 'ACCOUNT_EXISTS')

    const { data, error } = await admin.auth.admin.createUser({
      phone: input.phone,
      password: input.password,
      phone_confirm: true,
      user_metadata: { full_name: input.fullName, role: 'customer' },
    })
    if (error || !data.user) throw new ApiError(400, error?.message || 'Unable to create account.')

    const userId = data.user.id
    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId,
      full_name: input.fullName,
      phone: input.phone,
      role: 'customer',
      is_admin: false,
      phone_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (profileError) {
      await admin.auth.admin.deleteUser(userId)
      throw profileError
    }

    const { error: addressError } = await admin.from('customer_addresses').insert({
      user_id: userId,
      label: input.address.label,
      recipient_name: input.address.recipientName,
      phone: input.address.phone,
      house: input.address.house,
      area: input.address.area,
      landmark: input.address.landmark || null,
      city: input.address.city,
      postal_code: input.address.postalCode || null,
      latitude: input.address.latitude,
      longitude: input.address.longitude,
      is_default: true,
    })
    if (addressError) {
      await admin.auth.admin.deleteUser(userId)
      throw addressError
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
