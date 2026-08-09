import { createAdminClient } from '@/lib/supabase/admin'
import { ApiError } from './errors'

export type StoreSettings = {
  store_name: string
  is_open: boolean
  temporarily_closed: boolean
  opening_time: string
  closing_time: string
  timezone: string
  closed_message: string
  platform_fee_paise: number
  sugarcane_packaging_fee_paise: number
  delivery_fee_paise: number
  free_delivery_threshold_paise: number
  pickup_discount_percent: number
  delivery_city: string
  cafe_lat: number
  cafe_lng: number
  delivery_radius_km: number
  cod_enabled: boolean
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('store_settings')
    .select('store_name,is_open,temporarily_closed,opening_time,closing_time,timezone,closed_message,platform_fee_paise,sugarcane_packaging_fee_paise,delivery_fee_paise,free_delivery_threshold_paise,pickup_discount_percent,delivery_city,cafe_lat,cafe_lng,delivery_radius_km,cod_enabled')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  if (error || !data) throw new ApiError(503, 'Cafe settings are temporarily unavailable.', 'SETTINGS_UNAVAILABLE')
  return data as StoreSettings
}

export function currentStoreTime(settings: StoreSettings, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: settings.timezone,
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0)
  return hour * 60 + minute
}

const timeToMinutes = (value: string) => {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

export function storeAvailability(settings: StoreSettings, nowDate = new Date()) {
  if (!settings.is_open || settings.temporarily_closed) {
    return { canOrder: false, message: settings.closed_message }
  }
  const now = currentStoreTime(settings, nowDate)
  const opens = timeToMinutes(settings.opening_time)
  const closes = timeToMinutes(settings.closing_time)
  const inside = opens <= closes ? now >= opens && now < closes : now >= opens || now < closes
  return {
    canOrder: inside,
    message: inside ? null : settings.closed_message,
  }
}
