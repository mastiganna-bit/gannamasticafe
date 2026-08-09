import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { getStoreSettings } from '@/lib/server/store'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  storeName: z.string().trim().min(2).max(80),
  isOpen: z.boolean(),
  temporarilyClosed: z.boolean(),
  openingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closedMessage: z.string().trim().min(5).max(240),
  platformFeePaise: z.number().int().min(0).max(100_000),
  sugarcanePackagingFeePaise: z.number().int().min(0).max(100_000),
  deliveryFeePaise: z.number().int().min(0).max(100_000),
  freeDeliveryThresholdPaise: z.number().int().min(0).max(10_000_000),
  pickupDiscountPercent: z.number().min(0).max(100),
  deliveryCity: z.string().trim().min(2).max(80),
  cafeLat: z.number().min(-90).max(90),
  cafeLng: z.number().min(-180).max(180),
  deliveryRadiusKm: z.number().positive().max(100),
  codEnabled: z.boolean(),
})

export async function GET() {
  try {
    await requireAdmin()
    return NextResponse.json(await getStoreSettings(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin()
    const input = schema.parse(await request.json())
    const admin = createAdminClient()
    const { data: current, error: findError } = await admin.from('store_settings').select('id').order('updated_at', { ascending: false }).limit(1).single()
    if (findError || !current) throw new ApiError(503, 'Store settings are not configured.', 'SETTINGS_UNAVAILABLE')
    const { error } = await admin.from('store_settings').update({
      store_name: input.storeName,
      is_open: input.isOpen,
      temporarily_closed: input.temporarilyClosed,
      opening_time: input.openingTime,
      closing_time: input.closingTime,
      closed_message: input.closedMessage,
      platform_fee_paise: input.platformFeePaise,
      sugarcane_packaging_fee_paise: input.sugarcanePackagingFeePaise,
      delivery_fee_paise: input.deliveryFeePaise,
      free_delivery_threshold_paise: input.freeDeliveryThresholdPaise,
      pickup_discount_percent: input.pickupDiscountPercent,
      delivery_city: input.deliveryCity,
      cafe_lat: input.cafeLat,
      cafe_lng: input.cafeLng,
      delivery_radius_km: input.deliveryRadiusKm,
      cod_enabled: input.codEnabled,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    }).eq('id', current.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
