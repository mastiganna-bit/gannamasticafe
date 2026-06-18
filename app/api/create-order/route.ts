import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
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
    const supabaseServer = await createClient()
    const { data: { user } } = await supabaseServer.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 })
    }

    const {
      amount,
      customer_name,
      customer_phone,
      customer_email,
      items,
      notes,
      delivery_type,
      delivery_address,
      delivery_notes,
      delivery_lat,
      delivery_lng,
      pin_adjusted,
    }: {
      amount: number
      customer_name: string
      customer_phone: string
      customer_email?: string
      items: CartItem[]
      notes?: string
      delivery_type?: 'dine_in' | 'takeaway' | 'delivery'
      delivery_address?: string
      delivery_notes?: string
      delivery_lat?: number
      delivery_lng?: number
      pin_adjusted?: boolean
    } = await request.json()

    // Validate inputs
    if (!customer_name || !customer_phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch dynamic extra cheese prices
    const { data: dbSettings } = await supabase
      .from('menu_items')
      .select('*, menu_item_sizes(*)')
      .eq('category', 'System')
      .eq('name', 'Extra Cheese Settings')
      .single()

    let dynamicCheesePrices = {
      standard: 2000,
      premiumPizzaSmall: 3000,
      premiumPizzaOther: 5000,
      specialItem: 3000
    }

    if (dbSettings && dbSettings.menu_item_sizes) {
      const sizes = dbSettings.menu_item_sizes as any[]
      const std = sizes.find(s => s.size_label === 'Standard Price')
      const premSmall = sizes.find(s => s.size_label === 'Premium Pizza (Small/Half) Price')
      const premOther = sizes.find(s => s.size_label === 'Premium Pizza (Medium/Large) Price')
      const spec = sizes.find(s => s.size_label === 'Special Item Price')

      if (std) dynamicCheesePrices.standard = std.price_paise
      if (premSmall) dynamicCheesePrices.premiumPizzaSmall = premSmall.price_paise
      if (premOther) dynamicCheesePrices.premiumPizzaOther = premOther.price_paise
      if (spec) dynamicCheesePrices.specialItem = spec.price_paise
    }

    // Calculate total price strictly on the server to prevent client-side price tampering scams
    let itemsSubtotal = 0
    let sugarcaneQty = 0
    let discountAmount = 0

    for (const item of items) {
      const { data: dbSize, error: sizeError } = await supabase
        .from('menu_item_sizes')
        .select('price_paise, size_label, menu_items (name, category)')
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
        const itemName = sizeData.menu_items?.name || ''
        itemPricePaise += getExtraCheesePrice(category, sizeLabel, itemName, dynamicCheesePrices)
      }

      const itemTotal = itemPricePaise * item.quantity
      itemsSubtotal += itemTotal

      const itemName = sizeData.menu_items?.name || ''
      const itemCategory = sizeData.menu_items?.category || ''
      const isSugarcane = itemName.toLowerCase().includes('sugarcane') ||
                          itemName.toLowerCase().includes('ganna') ||
                          (itemCategory && itemCategory.toLowerCase().includes('cane'))

      if (isSugarcane) {
        sugarcaneQty += item.quantity
      } else if (delivery_type === 'takeaway') {
        discountAmount += Math.round(0.10 * itemPricePaise * item.quantity)
      }
    }

    const packagingCharges = sugarcaneQty * 500
    const platformFee = 600 // ₹6 flat in paise
    const deliveryCharges = delivery_type === 'delivery'
      ? (itemsSubtotal < 29900 ? 5000 : 0)
      : 0

    const grandTotal = itemsSubtotal + packagingCharges + platformFee + deliveryCharges - discountAmount

    // Create Razorpay order with the database-validated secure price
    const razorpayOrder = await razorpay.orders.create({
      amount: grandTotal,  // 100% server-calculated and validated
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
        user_id: user.id,
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        items,
        total_paise: grandTotal,
        status: 'pending',
        razorpay_order_id: razorpayOrder.id,
        notes: notes || null,
        delivery_type: delivery_type || 'takeaway',
        delivery_address: delivery_address || null,
        delivery_notes: delivery_notes || null,
        delivery_status: delivery_type === 'delivery' ? 'unassigned' : 'delivered',
        delivery_lat: delivery_type === 'delivery' ? (delivery_lat || null) : null,
        delivery_lng: delivery_type === 'delivery' ? (delivery_lng || null) : null,
        pin_adjusted: delivery_type === 'delivery' ? (pin_adjusted || false) : false,
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
