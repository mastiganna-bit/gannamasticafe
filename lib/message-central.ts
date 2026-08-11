import { requireServerEnv } from '@/lib/env'
import { ApiError } from '@/lib/server/errors'

type MessageCentralResponse = {
  status?: number
  responseCode?: number
  message?: string
  token?: string
  verificationId?: string
  data?: { verificationId?: string }
}

function cleanCredential(value: string) {
  return value.trim().replace(/\\[rn]+$/g, '').trim()
}

async function requestJson(url: URL, options: RequestInit): Promise<MessageCentralResponse> {
  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    console.error('MessageCentral network request failed', error instanceof Error ? error.name : 'unknown')
    throw new ApiError(502, 'Verification SMS is temporarily unavailable. Please try again later.', 'SMS_FAILED')
  }
  const text = await response.text()
  let data: MessageCentralResponse
  try {
    data = JSON.parse(text || '{}')
  } catch {
    console.error('MessageCentral returned an invalid response', response.status)
    throw new ApiError(502, 'Verification SMS is temporarily unavailable. Please try again later.', 'SMS_FAILED')
  }
  if (!response.ok) {
    const providerCode = data.responseCode ?? data.status ?? response.status
    const providerMessage = data.data && 'errorMessage' in data.data
      ? data.data.errorMessage
      : data.message
    console.error('MessageCentral request failed', { httpStatus: response.status, providerCode, providerMessage })
    throw new ApiError(502, 'Verification SMS is temporarily unavailable. Please try again later.', 'SMS_FAILED')
  }
  return data
}

async function getMessageCentralToken() {
  const configuredToken = process.env.MESSAGECENTRAL_AUTH_TOKEN
    ? cleanCredential(process.env.MESSAGECENTRAL_AUTH_TOKEN)
    : ''
  if (configuredToken) return configuredToken

  const customerId = cleanCredential(requireServerEnv('MESSAGECENTRAL_CUSTOMER_ID'))
  const rawKey = cleanCredential(requireServerEnv('MESSAGECENTRAL_KEY'))
  const email = cleanCredential(requireServerEnv('MESSAGECENTRAL_EMAIL'))
  const url = new URL('https://cpaas.messagecentral.com/auth/v1/authentication/token')
  url.search = new URLSearchParams({
    customerId,
    key: Buffer.from(rawKey).toString('base64'),
    scope: 'NEW',
    country: '91',
    email,
  }).toString()

  const data = await requestJson(url, { method: 'GET', headers: { Accept: 'application/json' } })
  if ((data.status !== 200 && data.responseCode !== 200) || !data.token) {
    console.error('MessageCentral authentication response was unsuccessful', data.responseCode ?? data.status)
    throw new ApiError(502, 'Verification SMS is temporarily unavailable. Please try again later.', 'SMS_FAILED')
  }
  return data.token
}

export async function sendOtpViaMessageCentral(phone: string) {
  const token = await getMessageCentralToken()
  const url = new URL('https://cpaas.messagecentral.com/verification/v3/send')
  url.search = new URLSearchParams({
    countryCode: '91',
    customerId: cleanCredential(requireServerEnv('MESSAGECENTRAL_CUSTOMER_ID')),
    flowType: 'SMS',
    mobileNumber: phone.replace(/^\+91/, ''),
    otpLength: '6',
  }).toString()
  return requestJson(url, { method: 'POST', headers: { authToken: token, Accept: 'application/json' } })
}

export async function validateOtpViaMessageCentral(verificationId: string, code: string) {
  const token = await getMessageCentralToken()
  const url = new URL('https://cpaas.messagecentral.com/verification/v3/validateOtp')
  url.search = new URLSearchParams({ verificationId, code }).toString()
  return requestJson(url, { method: 'GET', headers: { authToken: token, Accept: 'application/json' } })
}
