import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { verifyOtpChallenge } from '@/lib/server/otp'
import { indianPhoneSchema, passwordSchema } from '@/lib/server/validation'

const requestSchema = z.object({
  challengeId: z.string().uuid(),
  otp: z.string().regex(/^\d{4,8}$/),
  phone: indianPhoneSchema,
  password: passwordSchema,
})

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json())
    await verifyOtpChallenge({
      challengeId: input.challengeId,
      phone: input.phone,
      purpose: 'password_reset',
      code: input.otp,
    })

    const admin = createAdminClient()
    const nationalPhone = input.phone.slice(3)
    const { data: profiles } = await admin.from('profiles').select('id').in('phone', [input.phone, nationalPhone]).limit(1)
    const userId = profiles?.[0]?.id
    if (!userId) throw new ApiError(400, 'The account could not be reset.', 'RESET_FAILED')

    const { error } = await admin.auth.admin.updateUserById(userId, {
      phone: input.phone,
      phone_confirm: true,
      password: input.password,
    })
    if (error) throw new ApiError(400, 'The account could not be reset.', 'RESET_FAILED')
    await admin.from('profiles').update({ phone: input.phone, phone_verified_at: new Date().toISOString() }).eq('id', userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
