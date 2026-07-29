async function fetchSafeJson(url: string, options: RequestInit) {
  const response = await fetch(url, options)
  const responseText = await response.text()
  
  if (!response.ok) {
    console.error(`MessageCentral Error [${response.status}] from ${url}:`, responseText)
  }

  let data
  try {
    data = JSON.parse(responseText || '{}')
  } catch (e) {
    console.error(`MessageCentral JSON Parse Error from ${url}:`, responseText)
    throw new Error(`MessageCentral API returned invalid JSON: ${responseText}`)
  }
  return data
}

export async function getMessageCentralToken() {
  const customerId = process.env.MESSAGECENTRAL_CUSTOMER_ID
  const key = process.env.MESSAGECENTRAL_KEY
  const email = process.env.MESSAGECENTRAL_EMAIL

  if (!customerId || !key) {
    throw new Error('MessageCentral credentials missing in .env')
  }

  // The key must be Base64 encoded as per the documentation
  const encodedKey = Buffer.from(key).toString('base64')

  const params = new URLSearchParams({
    customerId,
    key: encodedKey,
    scope: 'NEW',
    country: '91',
    email: email || '',
  })

  const url = `https://cpaas.messagecentral.com/auth/v1/authentication/token?${params.toString()}`

  const data = await fetchSafeJson(url, {
    method: 'GET',
    headers: { 'Accept': '*/*' },
    cache: 'no-store'
  })
  
  console.log('MessageCentral Token Gen Response:', JSON.stringify(data, null, 2))

  // The response might be returning `responseCode` instead of `status`
  if ((data.status !== 200 && data.responseCode !== 200) || !data.token) {
    console.error('MessageCentral Token Error Data:', data)
    throw new Error(data.message || 'Failed to generate MessageCentral token')
  }

  return data.token
}

export async function sendOtpViaMessageCentral(phone: string) {
  const token = await getMessageCentralToken()
  const customerId = process.env.MESSAGECENTRAL_CUSTOMER_ID!

  const cleanPhone = phone.replace(/^\+91/, '').trim()

  const params = new URLSearchParams({
    countryCode: '91',
    customerId,
    flowType: 'SMS',
    mobileNumber: cleanPhone,
    otpLength: '6'
  })

  const url = `https://cpaas.messagecentral.com/verification/v3/send?${params.toString()}`

  const data = await fetchSafeJson(url, {
    method: 'POST',
    headers: {
      'authToken': token,
      'Accept': '*/*'
    }
  })

  return data
}

export async function validateOtpViaMessageCentral(verificationId: string, code: string) {
  const token = await getMessageCentralToken()

  const params = new URLSearchParams({
    verificationId,
    code
  })

  const url = `https://cpaas.messagecentral.com/verification/v3/validateOtp?${params.toString()}`

  const data = await fetchSafeJson(url, {
    method: 'GET',
    headers: {
      'authToken': token,
      'Accept': '*/*'
    }
  })

  return data
}
