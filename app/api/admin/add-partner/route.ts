import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateOtpViaMessageCentral } from '@/lib/message-central'

export async function POST(req: Request) {
  try {
    const { fullName, phone, vehicleNumber, otp, verificationId } = await req.json()
    
    if (!otp || !verificationId) {
      return NextResponse.json({ error: 'OTP and verificationId are required.' }, { status: 400 })
    }

    // Ensure phone number matches standard format (+91 prefix if missing)
    let formattedPhone = phone
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+91' + formattedPhone
    }

    // 1. Validate the OTP via MessageCentral
    const mcResponse = await validateOtpViaMessageCentral(verificationId, otp)
    
    // According to MessageCentral VerifyNow API, a successful validation returns status 200 or responseCode 200
    // Check for success criteria
    if (mcResponse?.responseCode !== 200 && mcResponse?.status !== 200) {
      console.error('MessageCentral Validation Failed:', mcResponse)
      return NextResponse.json({ error: 'Invalid OTP or verification expired.' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Server misconfiguration: missing service key.' }, { status: 500 })
    }

    // Create a service client with admin privileges
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 2. Find or Create the user in Supabase
    let targetUserId = null

    // Check profiles table first (without prefix)
    const phoneNoPrefix = formattedPhone.replace('+91', '')
    const { data: profilesNoPrefix } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone', phoneNoPrefix)
      .limit(1)

    if (profilesNoPrefix && profilesNoPrefix.length > 0) {
      targetUserId = profilesNoPrefix[0].id
    } else {
      // Check profiles table (with prefix)
      const { data: profilesWithPrefix } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('phone', formattedPhone)
        .limit(1)

      if (profilesWithPrefix && profilesWithPrefix.length > 0) {
        targetUserId = profilesWithPrefix[0].id
      }
    }

    // If user doesn't exist, create them
    if (!targetUserId) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone: formattedPhone,
        phone_confirm: true,
        user_metadata: { role: 'delivery', full_name: fullName }
      })

      if (createError) {
        // Fallback in case of race condition or if phone exists in auth but not profiles
        if (createError.message.includes('already exists')) {
          return NextResponse.json({ error: 'User phone already exists in auth but missing from profiles table. Please contact support.' }, { status: 400 })
        }
        return NextResponse.json({ error: createError.message }, { status: 400 })
      }
      
      targetUserId = newUser.user.id
    } else {
      // Update role if user already existed
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        user_metadata: { role: 'delivery' }
      })
    }

    // 3. Insert into delivery_profiles
    const { error: profileError } = await supabaseAdmin
      .from('delivery_profiles')
      .upsert({
        user_id: targetUserId,
        full_name: fullName,
        phone: phoneNoPrefix,
        vehicle_number: vehicleNumber,
        is_active: true
      })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Partner added successfully!' })
    
  } catch (err: any) {
    console.error('Add partner error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
