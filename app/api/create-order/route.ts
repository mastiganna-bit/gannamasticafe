import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { z } from 'zod'
import { requireServerEnv } from '@/lib/env'
import { requireUser } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { buildQuote, deliveryTypeSchema, quoteItemSchema } from '@/lib/server/quote'
import { createAdminClient } from '@/lib/supabase/admin'

const requestSchema = z.object({
  clientOrderKey: z.string().uuid(),
  items: z.array(quoteItemSchema).min(1).max(40),
  deliveryType: deliveryTypeSchema,
  paymentMethod: z.enum(['online', 'cod']),
  addressId: z.string().uuid().optional(),
  tableNumber: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(500).optional().default(''),
})

export async function POST(request: Request) {
  try {
    const session = await requireUser()
    const input = requestSchema.parse(await request.json())
    const admin = createAdminClient()

    const { data: existing } = await admin.from('orders')
      .select('id,razorpay_order_id,total_paise,payment_method,payment_status,fulfillment_status')
      .eq('user_id', session.user.id)
      .eq('client_order_key', input.clientOrderKey)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({
        orderId: existing.id,
        order_db_id: existing.id,
        razorpayOrderId: existing.razorpay_order_id,
        razorpay_order_id: existing.razorpay_order_id,
        amount: existing.total_paise,
        paymentMethod: existing.payment_method,
        paymentStatus: existing.payment_status,
        fulfillmentStatus: existing.fulfillment_status,
        idempotentReplay: true,
      })
    }

    let address: Record<string, unknown> | null = null
    if (input.deliveryType === 'delivery') {
      if (!input.addressId) throw new ApiError(400, 'Select a saved delivery address.', 'ADDRESS_REQUIRED')
      const { data, error } = await admin.from('customer_addresses')
        .select('*')
        .eq('id', input.addressId)
        .eq('user_id', session.user.id)
        .single()
      if (error || !data) throw new ApiError(400, 'The selected address is unavailable.', 'INVALID_ADDRESS')
      address = data
    }
    if (input.deliveryType === 'dine_in' && !input.tableNumber) {
      throw new ApiError(400, 'Enter your table number.', 'TABLE_REQUIRED')
    }

    const latitude = address?.latitude as number | undefined
    const longitude = address?.longitude as number | undefined
    const quote = await buildQuote({ items: input.items, deliveryType: input.deliveryType, latitude, longitude })
    if (input.paymentMethod === 'cod' && !quote.settings.codEnabled) {
      throw new ApiError(409, 'Cash on delivery is currently unavailable.', 'COD_UNAVAILABLE')
    }

    const deliveryAddress = address
      ? [address.house, address.area, address.landmark, address.city, address.postal_code].filter(Boolean).join(', ')
      : null
    const legacyItems = quote.items.map((item) => ({
      menu_item_id: item.menu_item_id,
      size_id: item.size_id,
      name: item.item_name,
      size_label: item.size_label,
      price_paise: item.unit_price_paise,
      quantity: item.quantity,
      image_path: item.image_path,
      category: item.category,
      extra_cheese: item.addons.some((addon) => addon.code === 'extra_cheese'),
      extra_cheese_price_paise: item.addon_total_paise,
    }))

    const now = new Date().toISOString()
    const fulfillmentStatus = input.paymentMethod === 'cod' ? 'awaiting_acceptance' : 'awaiting_payment'
    const paymentStatus = input.paymentMethod === 'cod' ? 'cod_pending' : 'pending'
    const { data: order, error: orderError } = await admin.from('orders').insert({
      user_id: session.user.id,
      client_order_key: input.clientOrderKey,
      customer_name: (address?.recipient_name as string) || session.profile.full_name || 'Customer',
      customer_phone: (address?.phone as string) || session.profile.phone || session.user.phone,
      customer_email: session.user.email || null,
      items: legacyItems,
      total_paise: quote.totals.grandTotalPaise,
      original_total_paise: quote.totals.grandTotalPaise,
      items_subtotal_paise: quote.totals.itemsSubtotalPaise,
      packaging_fee_paise: quote.totals.packagingFeePaise,
      platform_fee_paise: quote.totals.platformFeePaise,
      delivery_fee_paise: quote.totals.deliveryFeePaise,
      discount_paise: quote.totals.discountPaise,
      status: input.paymentMethod === 'cod' ? 'paid' : 'pending',
      payment_method: input.paymentMethod,
      payment_status: paymentStatus,
      fulfillment_status: fulfillmentStatus,
      notes: input.deliveryType === 'dine_in' ? `${input.notes}\nTable: ${input.tableNumber}`.trim() : input.notes || null,
      delivery_type: input.deliveryType,
      address_id: input.addressId || null,
      delivery_address: deliveryAddress,
      delivery_house: address?.house || null,
      delivery_area: address?.area || null,
      delivery_landmark: address?.landmark || null,
      delivery_city: address?.city || null,
      delivery_lat: latitude ?? null,
      delivery_lng: longitude ?? null,
      delivery_status: input.deliveryType === 'delivery' ? 'unassigned' : 'delivered',
      created_at: now,
      updated_at: now,
    }).select('id,order_number').single()
    if (orderError || !order) throw orderError || new Error('Order was not saved.')

    const { error: itemsError } = await admin.from('order_items').insert(quote.items.map((item) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      size_id: item.size_id,
      item_name: item.item_name,
      size_label: item.size_label,
      unit_price_paise: item.unit_price_paise,
      addon_total_paise: item.addon_total_paise,
      quantity: item.quantity,
      line_total_paise: item.line_total_paise,
      addons: item.addons,
    })))
    if (itemsError) {
      await admin.from('orders').delete().eq('id', order.id)
      throw itemsError
    }

    await admin.from('order_events').insert({
      order_id: order.id,
      event_type: 'order_created',
      to_status: fulfillmentStatus,
      actor_id: session.user.id,
      actor_role: 'customer',
      metadata: { paymentMethod: input.paymentMethod, totalPaise: quote.totals.grandTotalPaise },
    })

    if (input.paymentMethod === 'cod') {
      return NextResponse.json({
        orderId: order.id,
        order_db_id: order.id,
        paymentMethod: 'cod',
        amount: quote.totals.grandTotalPaise,
        fulfillmentStatus,
      }, { status: 201 })
    }

    try {
      const razorpay = new Razorpay({
        key_id: requireServerEnv('RAZORPAY_KEY_ID'),
        key_secret: requireServerEnv('RAZORPAY_KEY_SECRET'),
      })
      const gatewayOrder = await razorpay.orders.create({
        amount: quote.totals.grandTotalPaise,
        currency: 'INR',
        receipt: `GM${order.order_number || Date.now()}`.slice(0, 40),
        notes: { internal_order_id: order.id, user_id: session.user.id },
      })
      const { error: gatewaySaveError } = await admin.from('orders').update({ razorpay_order_id: gatewayOrder.id }).eq('id', order.id)
      if (gatewaySaveError) throw gatewaySaveError
      return NextResponse.json({
        orderId: order.id,
        order_db_id: order.id,
        razorpayOrderId: gatewayOrder.id,
        razorpay_order_id: gatewayOrder.id,
        amount: quote.totals.grandTotalPaise,
        currency: 'INR',
        paymentMethod: 'online',
      }, { status: 201 })
    } catch {
      await admin.from('orders').update({ payment_status: 'failed', fulfillment_status: 'payment_failed', status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', order.id)
      throw new ApiError(502, 'Online payment could not be started. Your card was not charged.', 'PAYMENT_START_FAILED')
    }
  } catch (error) {
    return apiErrorResponse(error)
  }
}
