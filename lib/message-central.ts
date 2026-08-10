import { requireServerEnv } from '@/lib/env'

type MessageCentralResponse = {
  status?: number
  responseCode?: number
  message?: string
  token?: string
  verificationId?: string
  data?: { verificationId?: string }
}

async function requestJson(url: URL, options: RequestInit): Promise<MessageCentralResponse> {
  const response = await fetch(url, {
    ...options,
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  const text = await response.text()
  let data: MessageCentralResponse
  try {
    data = JSON.parse(text || '{}')
  } catch {
    throw new Error('SMS provider returned an invalid response.')
  }
  if (!response.ok) throw new Error('SMS provider request failed.')
  return data
}

async function getMessageCentralToken() {
  const customerId = requireServerEnv('MESSAGECENTRAL_CUSTOMER_ID')
  const rawKey = requireServerEnv('MESSAGECENTRAL_KEY')
  const email = requireServerEnv('MESSAGECENTRAL_EMAIL')
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
    throw new Error('SMS provider authentication failed.')
  }
  return data.token
}

export async function sendOtpViaMessageCentral(phone: string) {
  const token = await getMessageCentralToken()
  const url = new URL('https://cpaas.messagecentral.com/verification/v3/send')
  url.search = new URLSearchParams({
    countryCode: '91',
    customerId: requireServerEnv('MESSAGECENTRAL_CUSTOMER_ID'),
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
