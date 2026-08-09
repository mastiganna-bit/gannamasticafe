import { describe, expect, it } from 'vitest'
import { storeAvailability, type StoreSettings } from '@/lib/server/store'

const settings: StoreSettings = {
  store_name:'Gannamasti Cafe',is_open:true,temporarily_closed:false,opening_time:'10:00:00',closing_time:'22:00:00',timezone:'Asia/Kolkata',closed_message:'Cafe closed',
  platform_fee_paise:600,sugarcane_packaging_fee_paise:500,delivery_fee_paise:5000,free_delivery_threshold_paise:30000,pickup_discount_percent:10,
  delivery_city:'Rohtak',cafe_lat:28.88,cafe_lng:76.58,delivery_radius_km:20,cod_enabled:true,
}

describe('store availability', () => {
  it('opens at 10:00 and closes at 22:00 in India', () => {
    expect(storeAvailability(settings,new Date('2026-08-09T04:30:00.000Z')).canOrder).toBe(true)
    expect(storeAvailability(settings,new Date('2026-08-09T16:30:00.000Z')).canOrder).toBe(false)
  })
  it('honors emergency closure', () => {
    expect(storeAvailability({...settings,temporarily_closed:true},new Date('2026-08-09T08:00:00.000Z'))).toEqual({canOrder:false,message:'Cafe closed'})
  })
})
