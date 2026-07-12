import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { countryCode, mobileNumber, otpCode, verificationId, fullName } = await request.json()

    if (!countryCode || !mobileNumber || !otpCode || !verificationId) {
      return NextResponse.json(
        { error: 'Country code, mobile number, OTP, and verification ID are required' },
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

    console.log(`[MessageCentral] Verifying OTP for +${countryCode}${mobileNumber} (ID: ${verificationId})`)

    // 1. Authenticate with Message Central to get a CPAAS token
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
    const authToken = authData.token || (authData.data && authData.data.token)

    if (!authToken) {
      console.error('[MessageCentral] Auth token missing in response:', authData)
      return NextResponse.json(
        { error: 'Failed to retrieve auth token from SMS gateway' },
        { status: 500 }
      )
    }

    // 2. Validate OTP code via Message Central
    const validateUrl = `https://cpaas.messagecentral.com/verification/v3/validateOtp?customerId=${customerId}&countryCode=${countryCode}&mobileNumber=${mobileNumber}&verificationId=${verificationId}&code=${otpCode}`
    const validateRes = await fetch(validateUrl, {
      method: 'GET',
      headers: {
        'accept': '*/*',
        'authToken': authToken
      },
      cache: 'no-store'
    })

    if (!validateRes.ok) {
      const validateErrText = await validateRes.text()
      console.error('[MessageCentral] OTP validation request failed:', validateErrText)
      return NextResponse.json(
        { error: 'Invalid or expired OTP code' },
        { status: 400 }
      )
    }

    const validateData = await validateRes.json()
    console.log('[MessageCentral] Validate OTP response:', validateData)

    const isApproved = validateData.responseCode == 200 || 
                      (validateData.data && (validateData.data.responseCode == 200 || validateData.data.status === 'APPROVED'))

    if (!isApproved) {
      return NextResponse.json(
        { error: validateData.message || 'OTP validation failed. Please check the code.' },
        { status: 400 }
      )
    }

    // 3. Log user into Supabase using a unique synthetic email
    const fullPhoneNumber = `+${countryCode.replace(/\D/g, '')}${mobileNumber.replace(/\D/g, '')}`
    const syntheticEmail = `${countryCode.replace(/\D/g, '')}${mobileNumber.replace(/\D/g, '')}@phone.gannamasticafe.in`
    const adminSupabase = createAdminClient()

    let userId: string | null = null

    // Try creating the user first in case they are registering
    const { data: userData, error: createError } = await adminSupabase.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      user_metadata: { 
        phone: fullPhoneNumber,
        full_name: fullName || `Phone User (${fullPhoneNumber})`
      }
    })

    if (createError) {
      // If user already exists, it is fine, we will login the existing user
      if (createError.message?.toLowerCase().includes('already exists') || (createError as any).status === 422) {
        console.log(`[Supabase Auth] User with email ${syntheticEmail} already exists. Logging in...`)
      } else {
        console.error('[Supabase Auth] Error creating user:', createError)
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        )
      }
    } else if (userData?.user) {
      userId = userData.user.id
      console.log(`[Supabase Auth] Successfully created new user: ${userId}`)
    }

    // 4. Generate magic link for the user (works for both new and existing users)
    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: syntheticEmail
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('[Supabase Auth] Error generating login link:', linkError)
      return NextResponse.json(
        { error: 'Failed to generate authentication session' },
        { status: 500 }
      )
    }

    if (!userId && linkData.user) {
      userId = linkData.user.id
    }

    // 5. Update user's profile record in the database
    if (userId) {
      const updateData: any = {
        phone: fullPhoneNumber,
        email: syntheticEmail
      }
      if (fullName) {
        updateData.full_name = fullName
      }

      const { error: profileError } = await adminSupabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)

      if (profileError) {
        console.error('[Supabase Auth] Error updating profile table:', profileError)
      }
    }

    // 6. Sign in standard client using the generated token hash to establish session cookies
    const supabase = await createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink'
    })

    if (verifyError) {
      console.error('[Supabase Auth] Error verifying token hash:', verifyError)
      return NextResponse.json(
        { error: 'Failed to establish user session' },
        { status: 500 }
      )
    }

    console.log(`[Supabase Auth] Successfully logged in +${countryCode}${mobileNumber}`)
    return NextResponse.json({
      success: true,
      message: 'Login successful'
    })
  } catch (error) {
    console.error('Verify OTP route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
