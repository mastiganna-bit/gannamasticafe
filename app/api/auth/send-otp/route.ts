import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { countryCode, mobileNumber } = await request.json()

    if (!countryCode || !mobileNumber) {
      return NextResponse.json(
        { error: 'Country code and mobile number are required' },
        { status: 400 }
      )
    }

    const customerId = process.env.MESSAGECENTRAL_CUSTOMER_ID
    const rawKey = process.env.MESSAGECENTRAL_KEY
    const email = process.env.MESSAGECENTRAL_EMAIL

    if (!customerId || !rawKey || !email) {
      console.error('Message Central environment variables (MESSAGECENTRAL_CUSTOMER_ID, MESSAGECENTRAL_KEY, or MESSAGECENTRAL_EMAIL) are missing.')
      return NextResponse.json(
        { error: 'SMS authentication is not configured on the server.' },
        { status: 500 }
      )
    }

    // Automatically encode password to Base64
    const key = Buffer.from(rawKey).toString('base64')

    console.log(`[MessageCentral] Initiating OTP send for +${countryCode}${mobileNumber}`)

    // 1. Authenticate with Message Central
    const authUrl = `https://cpaas.messagecentral.com/auth/v1/authentication/token?customerId=${customerId}&key=${key}&scope=NEW&country=${countryCode}&email=${encodeURIComponent(email)}`
    const authRes = await fetch(authUrl, {
      method: 'GET',
      headers: {
        'accept': '*/*'
      },
      cache: 'no-store'
    })

    if (!authRes.ok) {
      const authErrText = await authRes.text()
      console.error('[MessageCentral] Auth token generation failed:', authErrText)
      return NextResponse.json(
        { error: 'Failed to authenticate with SMS gateway' },
        { status: 500 }
      )
    }

    const authData = await authRes.json()
    console.log('[MessageCentral] Auth token response data:', authData)
    const authToken = authData.token || (authData.data && authData.data.token)
    console.log('[MessageCentral] Extracted authToken:', authToken ? `${authToken.substring(0, 10)}...` : 'null')

    if (!authToken) {
      console.error('[MessageCentral] Auth token missing in response:', authData)
      return NextResponse.json(
        { error: 'Failed to retrieve auth token from SMS gateway' },
        { status: 500 }
      )
    }

    // 2. Call Send OTP endpoint
    const sendUrl = `https://cpaas.messagecentral.com/verification/v3/send?customerId=${customerId}&countryCode=${countryCode}&mobileNumber=${mobileNumber}&flowType=SMS`
    const sendRes = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'authToken': authToken
      },
      cache: 'no-store'
    })

    if (!sendRes.ok) {
      const sendErrText = await sendRes.text()
      console.error('[MessageCentral] Send OTP HTTP error status:', sendRes.status, sendRes.statusText)
      console.error('[MessageCentral] Send OTP error response headers:', Object.fromEntries(sendRes.headers.entries()))
      console.error('[MessageCentral] Send OTP error body:', sendErrText)
      return NextResponse.json(
        { error: `Failed to send OTP code (Status ${sendRes.status}): ${sendErrText || 'No error message provided'}` },
        { status: 500 }
      )
    }

    const sendData = await sendRes.json()
    console.log('[MessageCentral] Send OTP response:', sendData)

    if (sendData.responseCode !== 200 || !sendData.data || !sendData.data.verificationId) {
      return NextResponse.json(
        { error: sendData.message || 'Error occurred while sending OTP' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      verificationId: sendData.data.verificationId
    })
  } catch (error) {
    console.error('Send OTP route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
