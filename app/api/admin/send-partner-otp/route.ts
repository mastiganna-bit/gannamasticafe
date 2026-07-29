import { NextResponse } from 'next/server'
import { sendOtpViaMessageCentral } from '@/lib/message-central'

export async function POST(req: Request) {
  try {
    const { phone } = await req.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 })
    }

    // Call MessageCentral API
    const response = await sendOtpViaMessageCentral(phone)
    
    // Check if the response contains verificationId (assuming it's in response.data.verificationId based on MessageCentral API)
    const verificationId = response?.data?.verificationId || response?.verificationId

    if (!verificationId) {
      console.error('MessageCentral Send Error:', response)
      return NextResponse.json({ error: 'Failed to send OTP via MessageCentral.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'OTP sent successfully!', verificationId })
  } catch (err: any) {
    console.error('Send OTP error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
