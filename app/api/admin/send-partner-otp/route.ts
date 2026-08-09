import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendOtpViaMessageCentral } from '@/lib/message-central'
import { requireAdmin } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { indianPhoneSchema } from '@/lib/server/validation'

const requestSchema = z.object({ phone: indianPhoneSchema })

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const { phone } = requestSchema.parse(await req.json())
    const response = await sendOtpViaMessageCentral(phone)
    const verificationId = response?.data?.verificationId || response?.verificationId
    if (!verificationId) throw new ApiError(502, 'The verification code could not be sent.', 'SMS_FAILED')
    return NextResponse.json({ success: true, verificationId })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
