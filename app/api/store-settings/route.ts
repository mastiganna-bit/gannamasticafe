import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/errors'
import { getStoreSettings, storeAvailability } from '@/lib/server/store'

export async function GET() {
  try {
    const settings = await getStoreSettings()
    const availability = storeAvailability(settings)
    return NextResponse.json({
      storeName: settings.store_name,
      canOrder: availability.canOrder,
      closedMessage: availability.message,
      openingTime: settings.opening_time,
      closingTime: settings.closing_time,
      timezone: settings.timezone,
      platformFeePaise: settings.platform_fee_paise,
      sugarcanePackagingFeePaise: settings.sugarcane_packaging_fee_paise,
      deliveryFeePaise: settings.delivery_fee_paise,
      freeDeliveryThresholdPaise: settings.free_delivery_threshold_paise,
      pickupDiscountPercent: Number(settings.pickup_discount_percent),
      deliveryCity: settings.delivery_city,
      deliveryRadiusKm: Number(settings.delivery_radius_km),
      codEnabled: settings.cod_enabled,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
