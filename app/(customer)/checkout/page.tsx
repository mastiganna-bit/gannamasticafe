'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { Banknote, Check, ChevronLeft, Loader2, LocateFixed, MapPin, Plus, Store, UtensilsCrossed } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCart } from '@/components/cart/CartProvider'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
import type { RazorpayOptions, RazorpayResponse } from '@/lib/types'

type DeliveryType = 'delivery' | 'takeaway' | 'dine_in'
type PaymentMethod = 'online' | 'cod'

type Address = {
  id: string
  label: string
  recipient_name: string
  phone: string
  house: string
  area: string
  landmark: string | null
  city: string
  postal_code: string | null
  latitude: number | null
  longitude: number | null
  is_default: boolean
}

type Quote = {
  totals: {
    itemsSubtotalPaise: number
    packagingFeePaise: number
    platformFeePaise: number
    deliveryFeePaise: number
    discountPaise: number
    grandTotalPaise: number
  }
  serviceability: { distanceKm: number | null; radiusKm: number }
  settings: { storeName: string; codEnabled: boolean; freeDeliveryThresholdPaise: number }
}

type StoreSettings = { canOrder: boolean; closedMessage: string | null; codEnabled: boolean; openingTime: string; closingTime: string }

export default function CheckoutPage() {
  const router = useRouter()
  const { items, clearCart } = useCart()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressId, setAddressId] = useState('')
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('delivery')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online')
  const [tableNumber, setTableNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [clientOrderKey, setClientOrderKey] = useState(() => crypto.randomUUID())

  const selectedAddress = addresses.find((address) => address.id === addressId)
  const requestItems = useMemo(() => items.map((item) => ({
    menu_item_id: item.menu_item_id,
    size_id: item.size_id,
    quantity: item.quantity,
    extra_cheese: Boolean(item.extra_cheese),
  })), [items])

  const loadAddresses = useCallback(async () => {
    const response = await fetch('/api/addresses', { cache: 'no-store' })
    if (!response.ok) return
    const result = await response.json()
    setAddresses(result.addresses || [])
    const preferred = result.addresses?.find((address: Address) => address.is_default) || result.addresses?.[0]
    setAddressId((current) => result.addresses?.some((address: Address) => address.id === current) ? current : preferred?.id || '')
  }, [])

  useEffect(() => {
    const initialize = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login?next=/checkout')
        return
      }
      await Promise.all([
        loadAddresses(),
        fetch('/api/store-settings', { cache: 'no-store' }).then(async (response) => {
          if (response.ok) setSettings(await response.json())
        }),
      ])
      setCheckingAuth(false)
    }
    initialize()
  }, [loadAddresses, router])

  useEffect(() => {
    setClientOrderKey(crypto.randomUUID())
  }, [requestItems, deliveryType, addressId, paymentMethod])

  useEffect(() => {
    if (!requestItems.length || (deliveryType === 'delivery' && !selectedAddress)) {
      setQuote(null)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoadingQuote(true)
      setQuoteError('')
      try {
        const response = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            items: requestItems,
            deliveryType,
            latitude: deliveryType === 'delivery' ? selectedAddress?.latitude : undefined,
            longitude: deliveryType === 'delivery' ? selectedAddress?.longitude : undefined,
          }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to calculate order total.')
        setQuote(result)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setQuote(null)
          setQuoteError(error instanceof Error ? error.message : 'Unable to calculate order total.')
        }
      } finally {
        setLoadingQuote(false)
      }
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [requestItems, deliveryType, selectedAddress])

  useEffect(() => {
    if (settings && !settings.codEnabled && paymentMethod === 'cod') setPaymentMethod('online')
  }, [settings, paymentMethod])

  const deleteAddress = async (address: Address) => {
    if (!window.confirm(`Delete ${address.label} address?`)) return
    try {
      const response = await fetch(`/api/addresses/${address.id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Address could not be deleted.')
      toast.success('Address deleted.')
      await loadAddresses()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Address could not be deleted.')
    }
  }

  const placeOrder = async (event: FormEvent) => {
    event.preventDefault()
    if (!quote) return toast.error(quoteError || 'Order total is not ready.')
    if (deliveryType === 'delivery' && !addressId) return toast.error('Select a delivery address.')
    if (deliveryType === 'dine_in' && !tableNumber.trim()) return toast.error('Enter your table number.')
    setSubmitting(true)
    try {
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientOrderKey,
          items: requestItems,
          deliveryType,
          paymentMethod,
          addressId: deliveryType === 'delivery' ? addressId : undefined,
          tableNumber: deliveryType === 'dine_in' ? tableNumber : undefined,
          notes,
        }),
      })
      const order = await response.json()
      if (!response.ok) throw new Error(order.error || 'Order could not be created.')

      if (paymentMethod === 'cod') {
        clearCart()
        toast.success('Order placed. Pay when you receive it.')
        router.push(`/order-success?order_id=${order.orderId}`)
        return
      }

      if (!window.Razorpay || !order.razorpayOrderId) throw new Error('Secure payment window is unavailable.')
      const options: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount: order.amount,
        currency: 'INR',
        name: 'Gannamasti Cafe',
        description: `${deliveryType === 'delivery' ? 'Home Delivery' : deliveryType === 'dine_in' ? 'Dine-In' : 'Self-Pickup'} Order`,
        image: '/images/logo.png',
        order_id: order.razorpayOrderId,
        handler: async (payment: RazorpayResponse) => {
          try {
            const verify = await fetch('/api/verify-payment', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: order.orderId,
                razorpayOrderId: payment.razorpay_order_id,
                razorpayPaymentId: payment.razorpay_payment_id,
                razorpaySignature: payment.razorpay_signature,
              }),
            })
            const result = await verify.json()
            if (!verify.ok || !result.success) throw new Error(result.error || 'Payment verification failed.')
            clearCart()
            toast.success('Payment verified and order placed!')
            router.push(`/order-success?order_id=${order.orderId}`)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Payment verification failed. Your order will reconcile automatically.')
          } finally {
            setSubmitting(false)
          }
        },
        theme: { color: '#3D6B4F' },
        modal: { ondismiss: () => { setSubmitting(false); toast('Payment window closed.', { icon: 'ℹ️' }) } },
      }
      new window.Razorpay(options).open()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  if (checkingAuth) return <LoadingPage label="Checking your account…" />
  if (!items.length) return <main className="min-h-screen bg-cream px-4 pt-32 text-center"><h1 className="font-display text-3xl text-cocoa">Your cart is empty</h1><Link href="/menu" className="btn-primary mt-6 inline-block">Browse menu</Link></main>

  return <>
    <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
    <main className="min-h-screen bg-cream px-4 pb-20 pt-24">
      <form onSubmit={placeOrder} className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Link href="/menu" className="inline-flex items-center gap-1 text-sm font-semibold text-sage"><ChevronLeft size={16} /> Continue shopping</Link>
          <section className="rounded-2xl border border-linen bg-white p-5 shadow-card">
            <h1 className="font-display text-3xl text-cocoa">Checkout</h1>
            {settings && !settings.canOrder && <div className="mt-4 rounded-xl border border-amber-cafe/30 bg-amber-cafe/10 p-3 text-sm text-cocoa">{settings.closedMessage}</div>}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Option active={deliveryType === 'delivery'} onClick={() => setDeliveryType('delivery')} icon={<MapPin />} label="Delivery" />
              <Option active={deliveryType === 'takeaway'} onClick={() => setDeliveryType('takeaway')} icon={<Store />} label="Self-pickup" />
              <Option active={deliveryType === 'dine_in'} onClick={() => setDeliveryType('dine_in')} icon={<UtensilsCrossed />} label="Dine-in" />
            </div>
          </section>

          {deliveryType === 'delivery' && <section className="rounded-2xl border border-linen bg-white p-5 shadow-card">
            <div className="flex items-center justify-between"><h2 className="font-display text-2xl text-cocoa">Delivery address</h2><button type="button" onClick={() => { setEditingAddress(null); setShowAddressForm(true) }} className="flex items-center gap-1 text-sm font-semibold text-sage"><Plus size={15} /> Add address</button></div>
            <div className="mt-4 grid gap-3">{addresses.map((address) => <article key={address.id} className={`relative rounded-xl border p-4 ${addressId === address.id ? 'border-sage bg-sage/5' : 'border-linen'}`}><button type="button" onClick={() => setAddressId(address.id)} className="w-full pr-7 text-left"><p className="font-bold text-cocoa">{address.label} {address.is_default && <span className="ml-2 text-xs font-medium text-sage">Default</span>}</p><p className="mt-1 text-sm text-cocoa-muted">{[address.house, address.area, address.landmark, address.city, address.postal_code].filter(Boolean).join(', ')}</p>{address.latitude === null || address.longitude === null ? <p className="mt-2 text-xs font-semibold text-amber-700">Map location required before delivery</p> : null}{addressId === address.id && <Check size={17} className="absolute right-3 top-3 text-sage" />}</button><div className="mt-3 flex gap-3 border-t border-linen pt-3 text-xs font-semibold"><button type="button" className="text-sage-dark" onClick={() => { setEditingAddress(address); setShowAddressForm(true) }}>Edit</button><button type="button" className="text-red-700" onClick={() => deleteAddress(address)}>Delete</button></div></article>)}</div>
            {!addresses.length && <p className="mt-4 rounded-xl bg-cream-200 p-4 text-sm text-cocoa-muted">Add a saved address with a map location to check delivery availability.</p>}
            {showAddressForm && <AddressForm address={editingAddress} onCancel={() => { setShowAddressForm(false); setEditingAddress(null) }} onSaved={async () => { setShowAddressForm(false); setEditingAddress(null); await loadAddresses() }} />}
          </section>}

          {deliveryType === 'dine_in' && <section className="rounded-2xl border border-linen bg-white p-5 shadow-card"><label className="text-sm font-semibold text-cocoa">Table number<input value={tableNumber} onChange={(event) => setTableNumber(event.target.value.slice(0, 20))} className="mt-2 w-full rounded-xl border border-linen px-4 py-3 outline-none focus:border-sage" required /></label></section>}

          <section className="rounded-2xl border border-linen bg-white p-5 shadow-card">
            <h2 className="font-display text-2xl text-cocoa">Payment</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><Option active={paymentMethod === 'online'} onClick={() => setPaymentMethod('online')} icon={<LockIcon />} label="Pay securely online" />{(settings?.codEnabled ?? true) && <Option active={paymentMethod === 'cod'} onClick={() => setPaymentMethod('cod')} icon={<Banknote />} label={deliveryType === 'delivery' ? 'Cash on delivery' : 'Pay at cafe'} />}</div>
            <label className="mt-5 block text-sm font-semibold text-cocoa">Preparation notes <span className="font-normal text-cocoa-muted">(optional)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 500))} rows={3} className="mt-2 w-full resize-none rounded-xl border border-linen px-4 py-3 outline-none focus:border-sage" placeholder="No onion, less spicy…" /></label>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-linen bg-white p-5 shadow-card lg:sticky lg:top-24">
          <h2 className="font-display text-2xl text-cocoa">Order summary</h2>
          <div className="mt-4 max-h-64 space-y-3 overflow-y-auto">{items.map((item) => <div key={`${item.size_id}-${item.extra_cheese}`} className="flex justify-between gap-4 text-sm"><span className="text-cocoa">{item.quantity}× {item.name} <small className="block text-cocoa-muted">{item.size_label}{item.extra_cheese ? ' · Extra cheese' : ''}</small></span></div>)}</div>
          {loadingQuote && <div className="mt-5 flex items-center gap-2 text-sm text-cocoa-muted"><Loader2 size={15} className="animate-spin" /> Calculating securely…</div>}
          {quoteError && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{quoteError}</div>}
          {quote && <div className="mt-5 space-y-2 border-t border-linen pt-4 text-sm">
            <SummaryRow label="Items" value={quote.totals.itemsSubtotalPaise} />
            {quote.totals.packagingFeePaise > 0 && <SummaryRow label="Sugarcane packaging" value={quote.totals.packagingFeePaise} />}
            <SummaryRow label="Platform fee" value={quote.totals.platformFeePaise} />
            {deliveryType === 'delivery' && <SummaryRow label="Delivery" value={quote.totals.deliveryFeePaise} freeLabel />}
            {quote.totals.discountPaise > 0 && <SummaryRow label="Pickup discount" value={-quote.totals.discountPaise} />}
            <div className="flex justify-between border-t border-linen pt-3 text-base font-bold text-cocoa"><span>Total</span><span>{formatPrice(quote.totals.grandTotalPaise)}</span></div>
            {quote.serviceability.distanceKm !== null && <p className="text-xs text-sage">Delivery available · {quote.serviceability.distanceKm} km from cafe</p>}
          </div>}
          <button className="btn-primary mt-5 flex w-full items-center justify-center gap-2" disabled={submitting || loadingQuote || !quote || settings?.canOrder === false}>{submitting && <Loader2 size={16} className="animate-spin" />}{paymentMethod === 'cod' ? 'Place order' : 'Proceed to secure payment'}</button>
          <p className="mt-3 text-center text-[11px] text-cocoa-muted">Prices are verified by the server before the order is created.</p>
        </aside>
      </form>
    </main>
  </>
}

function Option({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" onClick={onClick} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold ${active ? 'border-sage bg-sage/10 text-sage' : 'border-linen text-cocoa'}`}>{icon}{label}</button>
}

function SummaryRow({ label, value, freeLabel }: { label: string; value: number; freeLabel?: boolean }) {
  return <div className="flex justify-between text-cocoa-muted"><span>{label}</span><span className={value < 0 ? 'text-sage' : 'text-cocoa'}>{freeLabel && value === 0 ? 'FREE' : formatPrice(value)}</span></div>
}

function LoadingPage({ label }: { label: string }) { return <div className="flex min-h-screen items-center justify-center bg-cream"><Loader2 className="mr-2 animate-spin text-sage" /> <span className="text-sm text-cocoa-muted">{label}</span></div> }
function LockIcon() { return <span aria-hidden>🔒</span> }

function AddressForm({ address, onSaved, onCancel }: { address: Address | null; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState({
    label: address?.label || 'Home', recipientName: address?.recipient_name || '', phone: address?.phone.replace(/^\+91/, '') || '',
    house: address?.house || '', area: address?.area || '', landmark: address?.landmark || '', city: address?.city || 'Rohtak',
    postalCode: address?.postal_code || '', latitude: address?.latitude ?? null, longitude: address?.longitude ?? null,
    isDefault: address?.is_default || false,
  })
  const [busy, setBusy] = useState(false)
  const set = (key: keyof typeof form, value: string | number | boolean | null) => setForm((current) => ({ ...current, [key]: value }))
  const locate = () => navigator.geolocation?.getCurrentPosition(({ coords }) => { set('latitude', coords.latitude); set('longitude', coords.longitude); toast.success('Map location detected.') }, () => toast.error('Location permission was not granted.'), { enableHighAccuracy: true, timeout: 12_000 })
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (form.latitude === null || form.longitude === null) return toast.error('Detect the map location first.')
    setBusy(true)
    try {
      const response = await fetch(address ? `/api/addresses/${address.id}` : '/api/addresses', { method: address ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Address could not be saved.')
      toast.success(address ? 'Address updated.' : 'Address saved.')
      await onSaved()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Address could not be saved.') } finally { setBusy(false) }
  }
  const input = 'w-full rounded-xl border border-linen px-3 py-2.5 text-sm outline-none focus:border-sage'
  return <form onSubmit={save} className="mt-5 grid gap-3 rounded-xl border border-linen bg-cream-100 p-4 sm:grid-cols-2">
    <input className={input} placeholder="Address label (Home)" value={form.label} onChange={(e) => set('label', e.target.value)} required />
    <input className={input} placeholder="Recipient name" value={form.recipientName} onChange={(e) => set('recipientName', e.target.value)} required />
    <input className={input} placeholder="10-digit mobile number" inputMode="numeric" value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} required />
    <input className={input} placeholder="House / shop" value={form.house} onChange={(e) => set('house', e.target.value)} required />
    <input className={input} placeholder="Area" value={form.area} onChange={(e) => set('area', e.target.value)} required />
    <input className={input} placeholder="Landmark (optional)" value={form.landmark} onChange={(e) => set('landmark', e.target.value)} />
    <input className={input} placeholder="City" value={form.city} onChange={(e) => set('city', e.target.value)} required />
    <input className={input} placeholder="PIN code" inputMode="numeric" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value.replace(/\D/g, '').slice(0, 6))} />
    <button type="button" onClick={locate} className="flex items-center justify-center gap-2 rounded-xl border border-sage/30 bg-white px-3 py-2.5 text-sm font-semibold text-sage"><LocateFixed size={16} />{form.latitude === null ? 'Detect map location' : 'Location detected'}</button>
    <label className="flex items-center gap-2 text-sm text-cocoa"><input type="checkbox" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} className="accent-sage" /> Make default</label>
    <div className="flex gap-3 sm:col-span-2"><button className="btn-primary flex-1" disabled={busy}>{busy ? 'Saving…' : address ? 'Update address' : 'Save address'}</button><button type="button" onClick={onCancel} className="rounded-xl border border-linen px-4 py-3 text-sm font-semibold text-cocoa">Cancel</button></div>
  </form>
}
