import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateOtpViaMessageCentral } from '@/lib/message-central'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { indianPhoneSchema } from '@/lib/server/validation'
import { passwordSchema } from '@/lib/server/validation'

const requestSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: indianPhoneSchema,
  vehicleNumber: z.string().trim().min(2).max(30),
  otp: z.string().regex(/^\d{4,8}$/),
  verificationId: z.string().min(8).max(200),
  password: passwordSchema,
})

export async function POST(req: Request) {
  try {
    const adminSession = await requireAdmin()
    const input = requestSchema.parse(await req.json())
    const verification = await validateOtpViaMessageCentral(input.verificationId, input.otp)
    if (verification?.responseCode !== 200 && verification?.status !== 200) {
      throw new ApiError(400, 'The verification code is invalid or expired.', 'INVALID_OTP')
    }

    const supabase = createAdminClient()
    const nationalPhone = input.phone.slice(3)
    const { data: profiles, error: lookupError } = await supabase
      .from('profiles')
      .select('id, role')
      .in('phone', [input.phone, nationalPhone])
      .limit(1)
    if (lookupError) throw lookupError

    const existingProfile = profiles?.[0]
    if (existingProfile && existingProfile.role !== 'driver') {
      throw new ApiError(
        409,
        'This phone number already belongs to a customer or administrator account. Use a separate number for the delivery partner.',
        'ACCOUNT_EXISTS',
      )
    }

    let userId = existingProfile?.id as string | undefined
    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        phone: input.phone,
        phone_confirm: true,
        password: input.password,
        user_metadata: { role: 'driver', full_name: input.fullName },
      })
      if (error || !data.user) throw new ApiError(400, error?.message || 'Unable to create delivery partner.')
      userId = data.user.id
    }

    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      phone: input.phone,
      phone_confirm: true,
      password: input.password,
      user_metadata: { role: 'driver', full_name: input.fullName },
    })
    if (authError) throw authError

    const { error: profileError } = await supabase.from('profiles').update({
      full_name: input.fullName,
      phone: input.phone,
      role: 'driver',
    }).eq('id', userId)
    if (profileError) throw profileError

    const { error: driverError } = await supabase.from('delivery_profiles').upsert({
      user_id: userId,
      full_name: input.fullName,
      phone: input.phone,
      vehicle_number: input.vehicleNumber,
      is_active: true,
      is_approved: true,
      approved_by: adminSession.user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (driverError) throw driverError

    return NextResponse.json({ success: true, message: 'Delivery partner approved.' })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
