import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateReceiptId, getExtraCheesePrice } from '@/lib/utils'
import { CartItem } from '@/lib/types'

// Prevent runtime compilation errors if credentials aren't set yet during build
const keyId = process.env.RAZORPAY_KEY_ID || 'dummy_key'
const keySecret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
})

export async function POST(request: NextRequest) {
  try {
    const {
      amount,
      customer_name,
      customer_phone,
      customer_email,
      items,
      notes,
      user_id,
    }: {
      amount: number
      customer_name: string
      customer_phone: string
      customer_email?: string
      items: CartItem[]
      notes?: string
      user_id: string | null
    } = await request.json()

    // Validate inputs
    if (!customer_name || !customer_phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Calculate total price strictly on the server to prevent client-side price tampering scams
    let calculatedTotalPaise = 0
    for (const item of items) {
      const { data: dbSize, error: sizeError } = await supabase
        .from('menu_item_sizes')
        .select('price_paise, size_label, menu_items (category)')
        .eq('id', item.size_id)
        .single()

      if (sizeError || !dbSize) {
        console.error('Invalid size in cart:', item.size_id, sizeError)
        return NextResponse.json({ error: 'Invalid item size detected' }, { status: 400 })
      }

      const sizeData = dbSize as any
      let itemPricePaise = sizeData.price_paise

      if (item.extra_cheese) {
        const category = sizeData.menu_items?.category || ''
        const sizeLabel = sizeData.size_label || ''
        itemPricePaise += getExtraCheesePrice(category, sizeLabel)
      }

      calculatedTotalPaise += itemPricePaise * item.quantity
    }

    // Create Razorpay order with the database-validated secure price
    const razorpayOrder = await razorpay.orders.create({
      amount: calculatedTotalPaise,  // 100% server-calculated and validated
      currency: 'INR',
      receipt: generateReceiptId(),
      notes: {
        customer_name,
        customer_phone,
      },
    })

    // Save pending order in Supabase
    const { data: dbOrder, error: dbError } = await supabase
      .from('orders')
      .insert({
        user_id,
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        items,
        total_paise: calculatedTotalPaise,
        status: 'pending',
        razorpay_order_id: razorpayOrder.id,
        notes: notes || null,
      })
      .select()
      .single()

    if (dbError) {
      console.error('DB error:', dbError)
      return NextResponse.json({ error: 'Failed to save order' }, { status: 500 })
    }

    return NextResponse.json({
      razorpay_order_id: razorpayOrder.id,
      order_db_id: dbOrder.id,
      amount: razorpayOrder.amount,
    })
  } catch (error) {
    console.error('Create order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
