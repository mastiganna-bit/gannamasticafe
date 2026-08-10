import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendOtpViaMessageCentral } from '@/lib/message-central'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { assertOtpRateLimit, requestIpHash } from '@/lib/server/otp'
import { indianPhoneSchema } from '@/lib/server/validation'

const requestSchema = z.object({
  phone: indianPhoneSchema,
  purpose: z.enum(['signup', 'password_reset', 'account_claim']),
})

export async function POST(request: Request) {
  try {
    const { phone, purpose } = requestSchema.parse(await request.json())
    const ipHash = await requestIpHash()
    await assertOtpRateLimit(phone, ipHash)

    const provider = await sendOtpViaMessageCentral(phone)
    const providerVerificationId = provider?.data?.verificationId || provider?.verificationId
    if (!providerVerificationId) throw new ApiError(502, 'The verification code could not be sent.', 'SMS_FAILED')

    const admin = createAdminClient()
    const { data, error } = await admin.from('password_reset_challenges').insert({
      phone,
      provider_verification_id: providerVerificationId,
      request_ip_hash: ipHash,
      purpose,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    }).select('id, expires_at').single()
    if (error || !data) throw error || new Error('Challenge was not created.')

    return NextResponse.json({ challengeId: data.id, expiresAt: data.expires_at })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
