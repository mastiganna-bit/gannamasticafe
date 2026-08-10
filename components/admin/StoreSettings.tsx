'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Save, Settings } from 'lucide-react'
import toast from 'react-hot-toast'

type FormState = {
  storeName: string; isOpen: boolean; temporarilyClosed: boolean; openingTime: string; closingTime: string
  closedMessage: string; platformFee: number; packagingFee: number; deliveryFee: number
  freeDeliveryThreshold: number; pickupDiscountPercent: number; deliveryCity: string
  cafeLat: number; cafeLng: number; deliveryRadiusKm: number; codEnabled: boolean
}

const initial: FormState = {
  storeName: 'Gannamasti Cafe', isOpen: true, temporarilyClosed: false, openingTime: '10:00', closingTime: '22:00',
  closedMessage: 'Cafe is currently closed. You can browse the menu and order when we reopen.', platformFee: 6,
  packagingFee: 5, deliveryFee: 50, freeDeliveryThreshold: 300, pickupDiscountPercent: 10,
  deliveryCity: 'Rohtak', cafeLat: 28.88277, cafeLng: 76.58098, deliveryRadiusKm: 20, codEnabled: true,
}

export default function StoreSettings() {
  const [form, setForm] = useState(initial)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/store-settings', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load settings.')
        setForm({
          storeName: data.store_name, isOpen: data.is_open, temporarilyClosed: data.temporarily_closed,
          openingTime: String(data.opening_time).slice(0, 5), closingTime: String(data.closing_time).slice(0, 5),
          closedMessage: data.closed_message, platformFee: data.platform_fee_paise / 100,
          packagingFee: data.sugarcane_packaging_fee_paise / 100, deliveryFee: data.delivery_fee_paise / 100,
          freeDeliveryThreshold: data.free_delivery_threshold_paise / 100,
          pickupDiscountPercent: Number(data.pickup_discount_percent), deliveryCity: data.delivery_city,
          cafeLat: Number(data.cafe_lat), cafeLng: Number(data.cafe_lng), deliveryRadiusKm: Number(data.delivery_radius_km),
          codEnabled: data.cod_enabled,
        })
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false))
  }, [])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      const response = await fetch('/api/admin/store-settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: form.storeName, isOpen: form.isOpen, temporarilyClosed: form.temporarilyClosed,
          openingTime: form.openingTime, closingTime: form.closingTime, closedMessage: form.closedMessage,
          platformFeePaise: Math.round(form.platformFee * 100), sugarcanePackagingFeePaise: Math.round(form.packagingFee * 100),
          deliveryFeePaise: Math.round(form.deliveryFee * 100), freeDeliveryThresholdPaise: Math.round(form.freeDeliveryThreshold * 100),
          pickupDiscountPercent: form.pickupDiscountPercent, deliveryCity: form.deliveryCity, cafeLat: form.cafeLat,
          cafeLng: form.cafeLng, deliveryRadiusKm: form.deliveryRadiusKm, codEnabled: form.codEnabled,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to save settings.')
      toast.success('Store settings saved.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save settings.') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-8 text-center text-sm text-cocoa-muted">Loading settings…</div>
  const numberField = (label: string, key: keyof FormState, step = 1) => (
    <label className="block text-sm font-semibold text-cocoa">{label}
      <input type="number" min="0" step={step} value={form[key] as number} onChange={(e) => set(key, Number(e.target.value) as never)} className="mt-1 w-full rounded-xl border border-linen bg-cream px-4 py-3" required />
    </label>
  )
  return <form onSubmit={submit} className="mx-auto max-w-4xl rounded-xl border border-linen bg-white p-6 shadow-card">
    <div className="mb-6 flex items-center gap-3 border-b border-linen pb-4"><Settings className="text-sage"/><div><h2 className="font-display text-xl text-cocoa">Store operations</h2><p className="text-xs text-cocoa-muted">All checkout totals and availability use these server-side values.</p></div></div>
    <div className="grid gap-5 md:grid-cols-2">
      <label className="text-sm font-semibold text-cocoa">Store name<input value={form.storeName} onChange={(e)=>set('storeName',e.target.value)} className="mt-1 w-full rounded-xl border border-linen bg-cream px-4 py-3"/></label>
      <label className="text-sm font-semibold text-cocoa">Delivery city<input value={form.deliveryCity} onChange={(e)=>set('deliveryCity',e.target.value)} className="mt-1 w-full rounded-xl border border-linen bg-cream px-4 py-3"/></label>
      <label className="text-sm font-semibold text-cocoa">Opening time<input type="time" value={form.openingTime} onChange={(e)=>set('openingTime',e.target.value)} className="mt-1 w-full rounded-xl border border-linen bg-cream px-4 py-3"/></label>
      <label className="text-sm font-semibold text-cocoa">Closing time<input type="time" value={form.closingTime} onChange={(e)=>set('closingTime',e.target.value)} className="mt-1 w-full rounded-xl border border-linen bg-cream px-4 py-3"/></label>
      {numberField('Platform fee (₹)', 'platformFee', .01)}{numberField('Sugarcane packaging per item (₹)', 'packagingFee', .01)}
      {numberField('Delivery fee (₹)', 'deliveryFee', .01)}{numberField('Free delivery from (₹)', 'freeDeliveryThreshold', .01)}
      {numberField('Pickup discount (%)', 'pickupDiscountPercent', .01)}{numberField('Delivery radius (km)', 'deliveryRadiusKm', .1)}
      {numberField('Cafe latitude', 'cafeLat', .000001)}{numberField('Cafe longitude', 'cafeLng', .000001)}
    </div>
    <label className="mt-5 block text-sm font-semibold text-cocoa">Closed message<textarea value={form.closedMessage} onChange={(e)=>set('closedMessage',e.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-linen bg-cream px-4 py-3"/></label>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.isOpen} onChange={(e)=>set('isOpen',e.target.checked)}/> Accept orders</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.temporarilyClosed} onChange={(e)=>set('temporarilyClosed',e.target.checked)}/> Temporary closure</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.codEnabled} onChange={(e)=>set('codEnabled',e.target.checked)}/> Cash on delivery</label>
    </div>
    <div className="mt-6 flex justify-end"><button disabled={saving} className="flex items-center gap-2 rounded-xl bg-sage px-6 py-3 font-bold text-white disabled:opacity-50"><Save size={18}/>{saving?'Saving…':'Save settings'}</button></div>
  </form>
}
