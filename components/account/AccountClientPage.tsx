'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Download, LogOut, MapPin, Package, Star, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

type OrderItem = { id: string; item_name: string; size_label: string; quantity: number; cancelled_quantity: number; line_total_paise: number }
type Review = { rating: number; comment: string | null }
type AccountOrder = {
  id: string; order_number: number | null; created_at: string; total_paise: number; original_total_paise?: number | null
  fulfillment_status: string; payment_method: string; payment_status: string; delivery_type: string
  delivery_city?: string | null; delivery_area?: string | null; delivery_house?: string | null; delivery_landmark?: string | null
  order_items: OrderItem[]; reviews: Review[]
}
type Notice = { id: string; title: string; message: string; is_read: boolean; created_at: string }
type Profile = { full_name: string | null; phone: string | null }
type Address = { id: string; label: string; house: string; area: string; landmark: string | null; city: string; is_default: boolean }

const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`
const statusLabel: Record<string, string> = {
  awaiting_payment: 'Payment pending', awaiting_acceptance: 'Awaiting cafe confirmation', accepted: 'Accepted', preparing: 'Preparing',
  ready: 'Ready', assigned: 'Driver assigned', picked_up: 'Out for delivery', delivered: 'Delivered', completed: 'Completed',
  cancellation_pending: 'Cancellation processing', cancelled: 'Cancelled', payment_failed: 'Payment failed',
}

export default function AccountClientPage({ orders, notifications, profile, addresses }: {
  orders: AccountOrder[]; notifications: Notice[]; profile: Profile | null; addresses: Address[]
}) {
  const router = useRouter()
  const [name, setName] = useState(profile?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [busyOrder, setBusyOrder] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const active = useMemo(() => orders.filter((order) => !['cancelled', 'completed', 'delivered', 'payment_failed'].includes(order.fulfillment_status)), [orders])
  const history = useMemo(() => orders.filter((order) => ['cancelled', 'completed', 'delivered', 'payment_failed'].includes(order.fulfillment_status)), [orders])

  async function jsonRequest(url: string, init: RequestInit) {
    const response = await fetch(url, init); const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Request failed.'); return data
  }
  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setSaving(true)
    try { await jsonRequest('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: name }) }); toast.success('Profile updated.'); router.refresh() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to update profile.') } finally { setSaving(false) }
  }
  async function cancel(orderId: string, item?: OrderItem) {
    const reason = window.prompt(item ? `Why do you want to cancel one ${item.item_name}?` : 'Why do you want to cancel this order?')?.trim()
    if (!reason) return
    setBusyOrder(orderId)
    try {
      await jsonRequest('/api/orders/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, reason, items: item ? [{ orderItemId: item.id, quantity: 1 }] : undefined }) })
      toast.success(item ? 'Item cancellation recorded.' : 'Order cancelled.'); router.refresh()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Cancellation failed.') } finally { setBusyOrder(null) }
  }
  async function showCode(orderId: string) {
    setBusyOrder(orderId)
    try { const data = await jsonRequest(`/api/orders/${orderId}/handover-code`, { cache: 'no-store' }); window.alert(`Delivery handover code: ${data.code}\nShare it only after receiving your food.`) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Code unavailable.') } finally { setBusyOrder(null) }
  }
  async function submitReview(event: FormEvent, orderId: string) {
    event.preventDefault(); setBusyOrder(orderId)
    try { await jsonRequest('/api/orders/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, rating, comment }) }); toast.success('Thank you for your review.'); setReviewing(null); setComment(''); router.refresh() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Review failed.') } finally { setBusyOrder(null) }
  }
  async function logout() { await createClient().auth.signOut(); router.replace('/'); router.refresh() }

  const renderOrder = (order: AccountOrder, completed: boolean) => {
    const cancellable = ['awaiting_payment', 'awaiting_acceptance'].includes(order.fulfillment_status)
    const review = order.reviews?.[0]
    return <article key={order.id} className="rounded-2xl border border-linen bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-linen pb-3">
        <div><p className="font-semibold text-cocoa">Order #{order.order_number || order.id.slice(0, 8).toUpperCase()}</p><p className="text-xs text-cocoa-muted">{new Date(order.created_at).toLocaleString('en-IN')}</p></div>
        <div className="text-right"><span className="rounded-full bg-sage/10 px-3 py-1 text-xs font-semibold text-sage-dark">{statusLabel[order.fulfillment_status] || order.fulfillment_status}</span><p className="mt-2 font-bold text-cocoa">{rupees(order.total_paise)}</p></div>
      </div>
      <div className="my-3 space-y-2">{order.order_items.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span>{item.item_name} ({item.size_label}) × {item.quantity - item.cancelled_quantity}{item.cancelled_quantity ? <em className="ml-2 text-cocoa-muted">{item.cancelled_quantity} cancelled</em> : null}</span><span>{rupees(item.line_total_paise)}</span></div>)}</div>
      <p className="text-xs text-cocoa-muted">{order.delivery_type.replace('_', ' ')} · {order.payment_method === 'cod' ? 'Cash on delivery' : 'Online payment'} ({order.payment_status})</p>
      {order.delivery_type === 'delivery' && order.delivery_city ? <p className="mt-1 text-xs text-cocoa-muted"><MapPin className="mr-1 inline" size={12}/>{[order.delivery_house,order.delivery_area,order.delivery_landmark,order.delivery_city].filter(Boolean).join(', ')}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={`/api/orders/${order.id}/receipt`} className="inline-flex items-center gap-1 rounded-lg border border-linen px-3 py-2 text-xs font-semibold"><Download size={14}/> Receipt</a>
        {['ready','assigned','picked_up'].includes(order.fulfillment_status) && order.delivery_type === 'delivery' ? <button disabled={busyOrder===order.id} onClick={()=>showCode(order.id)} className="rounded-lg bg-sage px-3 py-2 text-xs font-semibold text-white">Show handover code</button> : null}
        {cancellable ? <button disabled={busyOrder===order.id} onClick={()=>cancel(order.id)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Cancel order</button> : null}
      </div>
      {cancellable ? <div className="mt-3 border-t border-linen pt-3"><p className="mb-2 text-xs text-cocoa-muted">Need to cancel only one item?</p><div className="flex flex-wrap gap-2">{order.order_items.filter((item)=>item.quantity>item.cancelled_quantity).map((item)=><button key={item.id} disabled={busyOrder===order.id} onClick={()=>cancel(order.id,item)} className="rounded-md bg-cream px-2 py-1 text-xs">Cancel 1 × {item.item_name}</button>)}</div></div> : null}
      {completed && !review ? <button onClick={()=>setReviewing(order.id)} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-amber-700"><Star size={15}/> Review this order</button> : null}
      {review ? <p className="mt-3 text-sm text-cocoa"><Star className="mr-1 inline fill-amber-400 text-amber-400" size={14}/> {review.rating}/5 {review.comment ? `— ${review.comment}` : ''}</p> : null}
      {reviewing===order.id ? <form onSubmit={(event)=>submitReview(event,order.id)} className="mt-3 rounded-xl bg-cream p-3"><div className="flex gap-1">{[1,2,3,4,5].map((star)=><button type="button" key={star} onClick={()=>setRating(star)} aria-label={`${star} stars`}><Star size={20} className={star<=rating?'fill-amber-400 text-amber-400':'text-cocoa-muted'}/></button>)}</div><textarea value={comment} maxLength={500} onChange={(e)=>setComment(e.target.value)} placeholder="Tell us what you liked or what we should improve" className="mt-2 w-full rounded-lg border border-linen p-2 text-sm"/><button disabled={busyOrder===order.id} className="mt-2 rounded-lg bg-sage px-3 py-2 text-xs font-bold text-white">Submit review</button></form> : null}
    </article>
  }

  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-24">
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="font-display text-3xl text-cocoa">My account</h1><p className="text-sm text-cocoa-muted">Your saved details and cafe orders.</p></div><button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-linen px-4 py-2 text-sm"><LogOut size={16}/> Log out</button></div>
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <aside className="space-y-5">
        <form onSubmit={saveProfile} className="rounded-2xl border border-linen bg-white p-5"><h2 className="mb-4 flex items-center gap-2 font-semibold text-cocoa"><UserRound size={18}/> Personal details</h2><label className="text-xs text-cocoa-muted">Name<input value={name} onChange={(e)=>setName(e.target.value)} className="mt-1 w-full rounded-lg border border-linen p-3 text-sm text-cocoa"/></label><p className="mt-3 text-xs text-cocoa-muted">Mobile number</p><p className="text-sm text-cocoa">+91 {profile?.phone?.replace(/^\+91/, '')}</p><button disabled={saving} className="mt-4 rounded-lg bg-sage px-4 py-2 text-xs font-bold text-white">{saving?'Saving…':'Save name'}</button><Link href="/login?mode=forgot" className="ml-3 text-xs font-semibold text-sage-dark">Reset password</Link></form>
        <section className="rounded-2xl border border-linen bg-white p-5"><h2 className="mb-3 flex items-center gap-2 font-semibold text-cocoa"><MapPin size={18}/> Saved addresses</h2>{addresses.length ? addresses.map((address)=><div key={address.id} className="mb-3 rounded-xl bg-cream p-3 text-sm"><p className="font-semibold">{address.label}{address.is_default?' · Default':''}</p><p className="text-cocoa-muted">{[address.house,address.area,address.landmark,address.city].filter(Boolean).join(', ')}</p></div>) : <p className="text-sm text-cocoa-muted">Add an address during checkout.</p>}<Link href="/checkout" className="text-xs font-semibold text-sage-dark">Manage at checkout →</Link></section>
        <section className="rounded-2xl border border-linen bg-white p-5"><h2 className="mb-3 flex items-center gap-2 font-semibold text-cocoa"><Bell size={18}/> Updates</h2>{notifications.length ? notifications.slice(0,5).map((notice)=><div key={notice.id} className="mb-3 text-sm"><p className="font-semibold">{notice.title}</p><p className="text-xs text-cocoa-muted">{notice.message}</p></div>) : <p className="text-sm text-cocoa-muted">No new updates.</p>}</section>
      </aside>
      <section><h2 className="mb-4 flex items-center gap-2 font-display text-2xl text-cocoa"><Package size={21}/> Active orders</h2><div className="space-y-4">{active.length?active.map((order)=>renderOrder(order,false)):<div className="rounded-2xl bg-cream p-8 text-center text-sm text-cocoa-muted">No active orders. <Link className="font-semibold text-sage-dark" href="/menu">Browse the menu</Link></div>}</div><h2 className="mb-4 mt-10 font-display text-2xl text-cocoa">Order history</h2><div className="space-y-4">{history.length?history.map((order)=>renderOrder(order,true)):<p className="text-sm text-cocoa-muted">No past orders yet.</p>}</div></section>
    </div>
  </main>
}
