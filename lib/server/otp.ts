import crypto from 'crypto'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireServerEnv } from '@/lib/env'
import { ApiError } from './errors'
import { validateOtpViaMessageCentral } from '@/lib/message-central'

export type OtpPurpose = 'signup' | 'password_reset' | 'account_claim'

export async function requestIpHash() {
  const headerStore = await headers()
  const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headerStore.get('x-real-ip')
    || 'unknown'
  return crypto.createHmac('sha256', requireServerEnv('SUPABASE_SERVICE_ROLE_KEY')).update(ip).digest('hex')
}
export async function assertOtpRateLimit(phone: string, ipHash: string) {
  const admin = createAdminClient()
  const since = new Date(Date.now() - 10 * 60_000).toISOString()
  const [phoneResult, ipResult] = await Promise.all([
    admin.from('password_reset_challenges').select('id', { count: 'exact', head: true }).eq('phone', phone).gte('created_at', since),
    admin.from('password_reset_challenges').select('id', { count: 'exact', head: true }).eq('request_ip_hash', ipHash).gte('created_at', since),
  ])
  if ((phoneResult.count || 0) >= 3 || (ipResult.count || 0) >= 10) {
    throw new ApiError(429, 'Too many verification attempts. Please wait ten minutes.', 'RATE_LIMITED')
  }
}

export async function verifyOtpChallenge(input: {
  challengeId: string
  phone: string
  purpose: OtpPurpose
  code: string
}) {
  const admin = createAdminClient()
  const { data: challenge } = await admin.from('password_reset_challenges')
    .select('*')
    .eq('id', input.challengeId)
    .eq('phone', input.phone)
    .eq('purpose', input.purpose)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!challenge || challenge.attempts >= 5) {
    throw new ApiError(400, 'The verification request is invalid or expired.', 'INVALID_CHALLENGE')
  }

  const { data: claimed } = await admin.from('password_reset_challenges')
    .update({ attempts: challenge.attempts + 1 })
    .eq('id', challenge.id)
    .eq('attempts', challenge.attempts)
    .is('consumed_at', null)
    .select('id')
    .single()
  if (!claimed) throw new ApiError(409, 'Verification is already in progress. Please retry.', 'CHALLENGE_CONFLICT')

  const result = await validateOtpViaMessageCentral(challenge.provider_verification_id, input.code)
  if (result?.responseCode !== 200 && result?.status !== 200) {
    throw new ApiError(400, 'The verification code is incorrect or expired.', 'INVALID_OTP')
  }

  const consumedAt = new Date().toISOString()
  const { error } = await admin.from('password_reset_challenges')
    .update({ consumed_at: consumedAt })
    .eq('id', challenge.id)
    .is('consumed_at', null)
  if (error) throw error
}
