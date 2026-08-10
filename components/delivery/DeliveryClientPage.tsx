'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bike, ExternalLink, LogOut, MapPin, Navigation, Phone, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Driver = { user_id: string; full_name?: string | null; is_active: boolean; vehicle_number?: string | null }
type Item = { id: string; item_name: string; size_label: string; quantity: number; cancelled_quantity: number }
type DeliveryOrder = { id:string; order_number:number|null; created_at:string; customer_name:string; customer_phone:string; fulfillment_status:string; delivery_status:string; delivery_house:string|null; delivery_area:string|null; delivery_landmark:string|null; delivery_city:string|null; delivery_lat:number|null; delivery_lng:number|null; order_items:Item[] }

export default function DeliveryClientPage({ initialDriver }: { initialDriver: Driver }) {
  const router=useRouter()
  const [driver,setDriver]=useState(initialDriver),[orders,setOrders]=useState<DeliveryOrder[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null)
  const [codes,setCodes]=useState<Record<string,string>>({}),[gps,setGps]=useState<'idle'|'active'|'blocked'>('idle')
  const lastSent=useRef(0)
  const load=useCallback(async()=>{try{const response=await fetch('/api/delivery/orders',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Assignments unavailable.');setDriver(data.driver);setOrders(data.orders)}catch(error){toast.error(error instanceof Error?error.message:'Assignments unavailable.')}finally{setLoading(false)}},[])
  useEffect(()=>{load();const timer=window.setInterval(load,15000);return()=>window.clearInterval(timer)},[load])
  const active=orders.filter((order)=>!['delivered','cancelled'].includes(order.fulfillment_status))
  const completed=orders.filter((order)=>order.fulfillment_status==='delivered')
  const activeIds=active.map((order)=>order.id).join(',')

  useEffect(()=>{
    if(!driver.is_active||!activeIds||!navigator.geolocation){setGps('idle');return}
    const watcher=navigator.geolocation.watchPosition(async(position)=>{
      setGps('active');if(Date.now()-lastSent.current<12000)return;lastSent.current=Date.now()
      await Promise.all(activeIds.split(',').filter(Boolean).map((orderId)=>fetch('/api/delivery/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId,latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy})}).catch(()=>undefined)))
    },()=>setGps('blocked'),{enableHighAccuracy:true,maximumAge:10000,timeout:15000})
    return()=>navigator.geolocation.clearWatch(watcher)
  },[driver.is_active,activeIds])

  async function post(url:string,body:object){const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Action failed.');return data}
  async function duty(){setBusy('duty');try{const data=await post('/api/delivery/duty',{active:!driver.is_active});setDriver((value)=>({...value,is_active:data.active}));toast.success(data.active?'You are on duty.':'You are off duty.')}catch(error){toast.error(error instanceof Error?error.message:'Duty status failed.')}finally{setBusy(null)}}
  async function update(orderId:string,action:'pickup'|'deliver'){setBusy(orderId);try{await post('/api/delivery/update-status',{orderId,action,otp:action==='deliver'?codes[orderId]:undefined});toast.success(action==='pickup'?'Order picked up. GPS tracking is active.':'Delivery confirmed.');await load()}catch(error){toast.error(error instanceof Error?error.message:'Status update failed.')}finally{setBusy(null)}}
  async function logout(){await createClient().auth.signOut();router.replace('/');router.refresh()}

  return <main className="mx-auto min-h-screen max-w-4xl px-4 py-8"><header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-cocoa p-5 text-white"><div><h1 className="flex items-center gap-2 font-display text-2xl"><Bike/> Delivery dashboard</h1><p className="text-sm text-white/70">{driver.full_name||'Delivery partner'} · {driver.vehicle_number}</p></div><div className="flex gap-2"><button onClick={duty} disabled={busy==='duty'} className={`rounded-xl px-4 py-2 text-sm font-bold ${driver.is_active?'bg-emerald-500':'bg-white/15'}`}>{driver.is_active?'On duty':'Go on duty'}</button><button onClick={logout} aria-label="Log out" className="rounded-xl bg-white/10 p-2"><LogOut size={18}/></button></div></header>
  {gps==='blocked'?<div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Location permission is required while delivering. Enable precise location in your browser settings.</div>:null}
  {active.length&&driver.is_active?<div className="mb-5 flex items-center gap-2 rounded-xl bg-sage/10 p-3 text-sm text-sage-dark"><Navigation size={16}/>{gps==='active'?'Live location is being shared for assigned orders.':'Starting live location…'}</div>:null}
  <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl text-cocoa">Assigned deliveries ({active.length})</h2><button onClick={load} aria-label="Refresh assignments" className="rounded-lg border border-linen bg-white p-2"><RefreshCw size={16}/></button></div>
  {loading?<p className="p-8 text-center text-cocoa-muted">Loading assignments…</p>:active.length?<div className="space-y-4">{active.map((order)=><article key={order.id} className="rounded-2xl border border-linen bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><div><p className="font-bold text-cocoa">Order #{order.order_number||order.id.slice(0,8)}</p><p className="text-xs text-cocoa-muted">{new Date(order.created_at).toLocaleString('en-IN')}</p></div><span className="rounded-full bg-sage/10 px-3 py-1 text-xs font-bold text-sage-dark">{order.delivery_status.replace('_',' ')}</span></div><div className="my-4 border-y border-linen py-3"><p className="font-semibold">{order.customer_name}</p><a className="inline-flex items-center gap-1 text-sm text-sage-dark" href={`tel:${order.customer_phone}`}><Phone size={14}/>{order.customer_phone}</a><p className="mt-2 text-sm text-cocoa-muted"><MapPin className="mr-1 inline" size={14}/>{[order.delivery_house,order.delivery_area,order.delivery_landmark,order.delivery_city].filter(Boolean).join(', ')}</p>{order.delivery_lat&&order.delivery_lng?<a className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-sage-dark" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}`}><ExternalLink size={14}/> Open directions</a>:null}</div><div className="space-y-1 text-sm">{order.order_items.map((item)=><p key={item.id}>{item.quantity-item.cancelled_quantity} × {item.item_name} ({item.size_label})</p>)}</div>{order.delivery_status==='assigned'?<button disabled={!driver.is_active||busy===order.id} onClick={()=>update(order.id,'pickup')} className="mt-4 w-full rounded-xl bg-sage py-3 font-bold text-white disabled:opacity-50">Confirm cafe pickup</button>:null}{order.delivery_status==='picked_up'?<div className="mt-4"><label className="text-xs font-semibold text-cocoa">Customer’s 6-digit handover code<input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={codes[order.id]||''} onChange={(e)=>setCodes({...codes,[order.id]:e.target.value.replace(/\D/g,'')})} className="mt-1 w-full rounded-xl border border-linen p-3 text-center font-mono text-xl tracking-[.35em]"/></label><button disabled={!driver.is_active||codes[order.id]?.length!==6||busy===order.id} onClick={()=>update(order.id,'deliver')} className="mt-3 w-full rounded-xl bg-sage py-3 font-bold text-white disabled:opacity-50">Confirm customer handover</button></div>:null}</article>)}</div>:<div className="rounded-2xl bg-cream p-10 text-center text-cocoa-muted">No delivery is assigned right now. New jobs are assigned by the cafe admin.</div>}
  <h2 className="mb-4 mt-10 font-display text-2xl text-cocoa">Completed deliveries</h2><div className="space-y-3">{completed.slice(0,20).map((order)=><div key={order.id} className="flex justify-between rounded-xl border border-linen bg-white p-4 text-sm"><span>#{order.order_number||order.id.slice(0,8)} · {order.customer_name}</span><span className="font-semibold text-sage-dark">Delivered</span></div>)}</div>
  </main>
}
