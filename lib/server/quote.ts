import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { ApiError } from './errors'
import { getStoreSettings, storeAvailability } from './store'

export const deliveryTypeSchema = z.enum(['delivery', 'takeaway', 'dine_in'])
export type DeliveryType = z.infer<typeof deliveryTypeSchema>

// PostgreSQL's uuid type accepts the canonical 8-4-4-4-12 hexadecimal shape
// without enforcing RFC version/variant bits. The legacy menu contains valid
// PostgreSQL UUIDs generated in that form, so menu foreign keys must mirror the
// database contract instead of Zod's stricter RFC-only uuid validator.
const postgresUuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Invalid database identifier',
)

export const quoteItemSchema = z.object({
  menu_item_id: postgresUuidSchema,
  size_id: postgresUuidSchema,
  quantity: z.number().int().min(1).max(25),
  extra_cheese: z.boolean().optional().default(false),
})

export const quoteRequestSchema = z.object({
  items: z.array(quoteItemSchema).min(1).max(40),
  deliveryType: deliveryTypeSchema,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})

export type QuoteRequest = z.infer<typeof quoteRequestSchema>

type JoinedMenuItem = {
  id: string
  name: string
  category: string
  image_path: string
  is_available: boolean
  archived_at?: string | null
  allow_extra_cheese?: boolean
  extra_cheese_price_paise?: number | null
}
export async function buildQuote(raw: QuoteRequest) {
  const input = quoteRequestSchema.parse(raw)
  const settings = await getStoreSettings()
  const availability = storeAvailability(settings)
  if (!availability.canOrder) throw new ApiError(409, availability.message || 'The cafe is currently closed.', 'STORE_CLOSED')

  const admin = createAdminClient()
  const sizeIds = [...new Set(input.items.map((item) => item.size_id))]
  const { data: sizes, error } = await admin.from('menu_item_sizes')
    .select('id,menu_item_id,size_label,price_paise,is_available,extra_cheese_price_paise,menu_items(id,name,category,image_path,is_available,archived_at,allow_extra_cheese,extra_cheese_price_paise)')
    .in('id', sizeIds)
  if (error) throw error
  const sizeMap = new Map((sizes || []).map((size) => [size.id, size]))

  let subtotal = 0
  let packaging = 0
  let pickupDiscountBase = 0
  const normalizedItems = input.items.map((requested) => {
    const size = sizeMap.get(requested.size_id) as (typeof sizes extends Array<infer T> ? T : never) | undefined
    const relation = size?.menu_items as unknown
    const item = (Array.isArray(relation) ? relation[0] : relation) as JoinedMenuItem | null
    if (!size || !item || size.menu_item_id !== requested.menu_item_id || !size.is_available || !item.is_available || item.archived_at) {
      throw new ApiError(409, 'An item in your cart is no longer available. Please refresh your cart.', 'ITEM_UNAVAILABLE')
    }

    let addonPrice = 0
    const addons: Array<{ code: string; label: string; price_paise: number }> = []
    if (requested.extra_cheese) {
      if (!item.allow_extra_cheese) throw new ApiError(409, `Extra cheese is not available for ${item.name}.`, 'ADDON_UNAVAILABLE')
      addonPrice = Number(size.extra_cheese_price_paise ?? item.extra_cheese_price_paise ?? 0)
      if (addonPrice < 0) throw new ApiError(500, 'Invalid menu configuration.', 'MENU_CONFIGURATION_ERROR')
      addons.push({ code: 'extra_cheese', label: 'Extra Cheese', price_paise: addonPrice })
    }

    const unitPrice = Number(size.price_paise)
    const lineTotal = (unitPrice + addonPrice) * requested.quantity
    subtotal += lineTotal
    if (item.category === 'The Cane Bar') {
      packaging += settings.sugarcane_packaging_fee_paise * requested.quantity
    } else {
      pickupDiscountBase += lineTotal
    }

    return {
      menu_item_id: item.id,
      size_id: size.id,
      item_name: item.name,
      size_label: size.size_label,
      image_path: item.image_path,
      category: item.category,
      unit_price_paise: unitPrice,
      addon_total_paise: addonPrice,
      quantity: requested.quantity,
      line_total_paise: lineTotal,
      addons,
    }
  })

  let distanceKm: number | null = null
  if (input.deliveryType === 'delivery') {
    if (input.latitude === undefined || input.longitude === undefined) {
      throw new ApiError(400, 'A map location is required for delivery.', 'LOCATION_REQUIRED')
    }
    const { data, error: serviceError } = await admin.rpc('check_delivery_serviceability', {
      lat: input.latitude,
      lng: input.longitude,
    })
    if (serviceError || !data?.[0]) throw new ApiError(503, 'Delivery serviceability could not be checked.', 'SERVICEABILITY_UNAVAILABLE')
    if (!data[0].serviceable) {
      throw new ApiError(409, `This location is ${data[0].distance_km} km away and outside our ${data[0].radius_km} km delivery area.`, 'OUTSIDE_DELIVERY_AREA')
    }
    distanceKm = Number(data[0].distance_km)
  }

  const discount = input.deliveryType === 'takeaway'
    ? Math.round(pickupDiscountBase * Number(settings.pickup_discount_percent) / 100)
    : 0
  const deliveryFee = input.deliveryType === 'delivery' && subtotal < settings.free_delivery_threshold_paise
    ? settings.delivery_fee_paise
    : 0
  const platformFee = settings.platform_fee_paise
  const total = subtotal + packaging + platformFee + deliveryFee - discount
  if (!Number.isSafeInteger(total) || total < 0) throw new ApiError(500, 'The order total could not be calculated.', 'INVALID_TOTAL')

  return {
    items: normalizedItems,
    totals: {
      itemsSubtotalPaise: subtotal,
      packagingFeePaise: packaging,
      platformFeePaise: platformFee,
      deliveryFeePaise: deliveryFee,
      discountPaise: discount,
      grandTotalPaise: total,
    },
    serviceability: { distanceKm, radiusKm: Number(settings.delivery_radius_km) },
    settings: {
      storeName: settings.store_name,
      codEnabled: settings.cod_enabled,
      freeDeliveryThresholdPaise: settings.free_delivery_threshold_paise,
    },
  }
}
