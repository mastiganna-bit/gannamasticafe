'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  MapPin, Phone, ShoppingBag, CheckCircle, TrendingUp, 
  LogOut, Compass, Shield, User, Navigation, Eye, 
  Activity, AlertTriangle, Truck
} from 'lucide-react'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

interface Order {
  id: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  items: any[]
  total_paise: number
  status: string
  notes?: string
  delivery_type: string
  delivery_status: string
  delivery_address?: string
  delivery_notes?: string
  created_at: string
}

interface DriverProfile {
  user_id: string
  full_name: string
  phone: string
  vehicle_number: string
  is_active: boolean
}

interface DeliveryClientPageProps {
  user: any
  driverProfile: DriverProfile | null
  initialUnassigned: Order[]
  initialActive: Order[]
  initialCompleted: Order[]
}

export default function DeliveryClientPage({
  user,
  driverProfile: initialProfile,
  initialUnassigned,
  initialActive,
  initialCompleted,
}: DeliveryClientPageProps) {
  const supabase = createClient()
  const [profile, setProfile] = useState<DriverProfile | null>(initialProfile)
  
  // Registration Form State
  const [regName, setRegName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regVehicle, setRegVehicle] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)

  // Orders State
  const [unassigned, setUnassigned] = useState<Order[]>(initialUnassigned)
  const [active, setActive] = useState<Order[]>(initialActive)
  const [completed, setCompleted] = useState<Order[]>(initialCompleted)
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'completed'>('available')
  
  // Action Loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // GPS Tracking watch ID reference
  const [watchId, setWatchId] = useState<number | null>(null)

  // 1. Listen for new ready-to-deliver orders in real-time
  useEffect(() => {
    const channel = supabase
      .channel('delivery-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async () => {
          // Re-fetch orders to keep lists fresh
          const { data: unassignedOrders } = await supabase
            .from('orders')
            .select('*')
            .eq('delivery_type', 'delivery')
            .eq('status', 'completed')
            .eq('delivery_status', 'unassigned')
            .order('created_at', { ascending: false })

          const { data: activeOrders } = await supabase
            .from('orders')
            .select('*')
            .eq('delivery_boy_id', user.id)
            .neq('delivery_status', 'delivered')
            .order('created_at', { ascending: false })

          if (unassignedOrders) setUnassigned(unassignedOrders as Order[])
          if (activeOrders) setActive(activeOrders as Order[])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, user.id])

  // 2. Location Tracking Loop
  // Triggers automatically whenever there is an active order with status 'picked_up'
  useEffect(() => {
    const pickedUpOrder = active.find(o => o.delivery_status === 'picked_up')

    if (pickedUpOrder) {
      if (!watchId && 'geolocation' in navigator) {
        toast('Starting live GPS coordinate broadcasting...', { icon: '📍' })
        
        let lastLat = 0
        let lastLng = 0

        const id = navigator.geolocation.watchPosition(
          async (pos) => {
            const { latitude, longitude, heading, speed } = pos.coords
            
            // Throttle database writes unless driver moved significantly
            const distanceMoved = Math.sqrt(
              Math.pow(latitude - lastLat, 2) + Math.pow(longitude - lastLng, 2)
            )

            if (distanceMoved > 0.00005) { // roughly 5 meters
              lastLat = latitude
              lastLng = longitude

              const { error } = await supabase
                .from('delivery_locations')
                .upsert({
                  order_id: pickedUpOrder.id,
                  delivery_boy_id: user.id,
                  latitude,
                  longitude,
                  heading: heading || null,
                  speed: speed || null,
                  updated_at: new Date().toISOString()
                })

              if (error) {
                console.error('Failed to stream location:', error)
              }
            }
          },
          (err) => {
            console.error('GPS watch error:', err)
            toast.error('GPS signal error. Please ensure location services are enabled.')
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
        )
        setWatchId(id)
      }
    } else {
      // Clear GPS watch if no active delivery is in progress
      if (watchId) {
        navigator.geolocation.clearWatch(watchId)
        setWatchId(null)
        toast('GPS coordinate broadcasting stopped.', { icon: '📴' })
      }
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [active, watchId, user.id, supabase])

  // Handle Driver Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regName || !regPhone || !regVehicle) {
      toast.error('All profile fields are required!')
      return
    }

    setIsRegistering(true)
    try {
      const { data, error } = await supabase
        .from('delivery_profiles')
        .insert({
          user_id: user.id,
          full_name: regName,
          phone: regPhone,
          vehicle_number: regVehicle,
          is_active: true
        })
        .select()
        .single()

      if (error) throw error

      setProfile(data as DriverProfile)
      toast.success('Delivery Profile created successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create profile')
    } finally {
      setIsRegistering(false)
    }
  }

  // Handle Order Status Transitions via secure API
  const handleUpdateStatus = async (orderId: string, action: 'accept' | 'pickup' | 'deliver') => {
    setActionLoading(orderId)
    try {
      const res = await fetch('/api/delivery/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update status')

      toast.success(data.message || 'Status updated!')

      // Manually refresh lists
      const { data: unassignedOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('delivery_type', 'delivery')
        .eq('status', 'completed')
        .eq('delivery_status', 'unassigned')

      const { data: activeOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('delivery_boy_id', user.id)
        .neq('delivery_status', 'delivered')

      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const { data: completedOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('delivery_boy_id', user.id)
        .eq('delivery_status', 'delivered')
        .gte('updated_at', startOfDay.toISOString())

      if (unassignedOrders) setUnassigned(unassignedOrders as Order[])
      if (activeOrders) setActive(activeOrders as Order[])
      if (completedOrders) setCompleted(completedOrders as Order[])

      if (action === 'deliver') {
        setActiveTab('completed')
      } else if (action === 'accept') {
        setActiveTab('active')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update delivery stage')
    } finally {
      setActionLoading(null)
    }
  }

  // Toggle Active/Duty Status
  const toggleDutyStatus = async () => {
    if (!profile) return
    const nextStatus = !profile.is_active
    try {
      const { error } = await supabase
        .from('delivery_profiles')
        .update({ is_active: nextStatus })
        .eq('user_id', user.id)

      if (error) throw error

      setProfile(prev => prev ? { ...prev, is_active: nextStatus } : null)
      toast.success(nextStatus ? 'You are now ON DUTY' : 'You are now OFF DUTY')
    } catch (err: any) {
      toast.error('Failed to toggle duty status')
    }
  }

  // Helper: Format paise to currency (INR)
  const formatINR = (paise: number) => {
    return `₹${(paise / 100).toFixed(2)}`
  }

  // Helper: Get human-readable date
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // If driver has not set up a profile, show the register card
  if (!profile) {
    return (
      <div className="min-h-screen bg-cream pt-24 pb-16 flex items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white border border-linen p-6 rounded-2xl shadow-sm space-y-6"
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-sage/10 text-sage rounded-full flex items-center justify-center mx-auto mb-3">
              <Truck size={24} />
            </div>
            <h2 className="font-serif text-xl text-cocoa">Agent Onboarding</h2>
            <p className="font-sans text-xs text-cocoa-muted mt-1">Register your agent details below to begin accepting food deliveries.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-[10px] font-sans font-bold text-cocoa uppercase tracking-wider mb-1">Full Name</label>
              <input 
                type="text" 
                required
                value={regName}
                onChange={e => setRegName(e.target.value)}
                className="w-full bg-cream border border-linen rounded-xl p-3 text-xs text-cocoa focus:outline-none focus:ring-1 focus:ring-sage"
                placeholder="e.g. Rahul Sharma"
              />
            </div>
            <div>
              <label className="block text-[10px] font-sans font-bold text-cocoa uppercase tracking-wider mb-1">Phone Number</label>
              <input 
                type="tel" 
                required
                maxLength={10}
                value={regPhone}
                onChange={e => setRegPhone(e.target.value)}
                className="w-full bg-cream border border-linen rounded-xl p-3 text-xs text-cocoa focus:outline-none focus:ring-1 focus:ring-sage"
                placeholder="e.g. 9876543210"
              />
            </div>
            <div>
              <label className="block text-[10px] font-sans font-bold text-cocoa uppercase tracking-wider mb-1">Vehicle License Plate Number</label>
              <input 
                type="text" 
                required
                value={regVehicle}
                onChange={e => setRegVehicle(e.target.value)}
                className="w-full bg-cream border border-linen rounded-xl p-3 text-xs text-cocoa focus:outline-none focus:ring-1 focus:ring-sage"
                placeholder="e.g. DL-3C-AB-1234"
              />
            </div>

            <button
              type="submit"
              disabled={isRegistering}
              className="w-full bg-sage hover:bg-sage-dark text-white font-sans text-xs font-bold py-3.5 rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              {isRegistering ? 'Registering...' : 'Register Profile & Enter Dashboard'}
            </button>
          </form>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream pt-20 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        
        {/* Header card */}
        <div className="bg-white border border-linen rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-full bg-sage/10 text-sage flex items-center justify-center font-bold text-lg shrink-0">
              <User size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-base text-cocoa truncate">{profile.full_name}</h1>
              <p className="font-sans text-[11px] text-cocoa-muted flex items-center gap-1 mt-0.5">
                <Truck size={12} className="shrink-0" />
                <span className="truncate">{profile.vehicle_number}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Duty status toggle */}
            <button
              onClick={toggleDutyStatus}
              className={`font-sans text-[10px] font-bold py-1.5 px-3 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                profile.is_active 
                  ? 'bg-sage/10 text-sage border border-sage/20' 
                  : 'bg-cocoa-muted/10 text-cocoa-muted border border-cocoa-muted/20'
              }`}
            >
              <Activity size={10} className={profile.is_active ? 'animate-pulse' : ''} />
              {profile.is_active ? 'ON DUTY' : 'OFF DUTY'}
            </button>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="grid grid-cols-3 bg-white p-1 rounded-xl border border-linen shadow-xs">
          <button
            onClick={() => setActiveTab('available')}
            className={`font-sans text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'available' 
                ? 'bg-sage text-white shadow-xs' 
                : 'text-cocoa-muted hover:text-cocoa'
            }`}
          >
            <span>Available</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              activeTab === 'available' ? 'bg-white/20 text-white' : 'bg-cream text-cocoa-muted'
            }`}>
              {unassigned.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`font-sans text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'active' 
                ? 'bg-sage text-white shadow-xs' 
                : 'text-cocoa-muted hover:text-cocoa'
            }`}
          >
            <span>Active</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-cream text-cocoa-muted'
            }`}>
              {active.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`font-sans text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'completed' 
                ? 'bg-sage text-white shadow-xs' 
                : 'text-cocoa-muted hover:text-cocoa'
            }`}
          >
            <span>Completed</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              activeTab === 'completed' ? 'bg-white/20 text-white' : 'bg-cream text-cocoa-muted'
            }`}>
              {completed.length}
            </span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {activeTab === 'available' && (
              <motion.div
                key="available"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {unassigned.length === 0 ? (
                  <div className="bg-white border border-linen p-8 text-center rounded-2xl shadow-xs">
                    <Compass size={32} className="mx-auto text-linen mb-2" />
                    <p className="font-sans text-xs text-cocoa-muted">No new food delivery orders available right now.</p>
                  </div>
                ) : (
                  unassigned.map(order => (
                    <div key={order.id} className="bg-white border border-linen rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-linen pb-3">
                        <div>
                          <p className="font-sans text-[10px] text-sage font-bold tracking-widest uppercase">READY FOR DISPATCH</p>
                          <p className="font-sans text-[11px] text-cocoa-muted mt-0.5">Ordered at {formatTime(order.created_at)}</p>
                        </div>
                        <span className="font-serif text-sm font-semibold text-cocoa">{formatINR(order.total_paise)}</span>
                      </div>

                      <div className="space-y-2">
                        <p className="font-sans text-xs font-bold text-cocoa flex items-center gap-1.5">
                          <MapPin size={14} className="text-amber-cafe shrink-0" />
                          <span>{order.delivery_address}</span>
                        </p>
                        <p className="font-sans text-[11px] text-cocoa-muted">
                          Customer: <span className="font-medium text-cocoa">{order.customer_name}</span>
                        </p>
                        {order.notes && (
                          <div className="bg-cream/50 border border-linen/50 p-2.5 rounded-xl text-[10px] font-sans text-cocoa-muted italic">
                            Notes: {order.notes}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleUpdateStatus(order.id, 'accept')}
                        disabled={actionLoading !== null || !profile.is_active}
                        className="w-full bg-sage hover:bg-sage-dark text-white font-sans text-xs font-bold py-3 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {actionLoading === order.id ? 'Accepting...' : !profile.is_active ? 'Go On Duty to Accept' : 'Accept Delivery Duty'}
                      </button>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'active' && (
              <motion.div
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {active.length === 0 ? (
                  <div className="bg-white border border-linen p-8 text-center rounded-2xl shadow-xs">
                    <Compass size={32} className="mx-auto text-linen mb-2" />
                    <p className="font-sans text-xs text-cocoa-muted font-medium">You have no active orders assigned.</p>
                    <p className="font-sans text-[10px] text-cocoa-muted mt-1">Accept new delivery duties from the "Available" tab.</p>
                  </div>
                ) : (
                  active.map(order => (
                    <div key={order.id} className="bg-white border border-linen rounded-2xl p-5 shadow-xs space-y-4 border-l-4 border-l-amber-cafe">
                      
                      {/* Badge / Status */}
                      <div className="flex items-center justify-between border-b border-linen pb-3">
                        <div>
                          <p className="font-sans text-[10px] text-amber-cafe font-bold tracking-widest uppercase flex items-center gap-1">
                            <Activity size={10} className="animate-pulse" />
                            {order.delivery_status === 'assigned' ? 'Assigned (Pending Pickup)' : 'Out for Delivery (GPS Active)'}
                          </p>
                          <p className="font-sans text-[11px] text-cocoa-muted mt-0.5">Order ID: #{order.id.slice(0, 8)}</p>
                        </div>
                        <a 
                          href={`tel:${order.customer_phone}`}
                          className="bg-cream border border-linen text-cocoa p-2 rounded-xl flex items-center justify-center hover:bg-linen transition-colors"
                        >
                          <Phone size={14} />
                        </a>
                      </div>

                      {/* Info block */}
                      <div className="space-y-3 font-sans text-xs text-cocoa">
                        <div className="flex items-start gap-2">
                          <MapPin size={16} className="text-sage mt-0.5 shrink-0" />
                          <div>
                            <span className="font-bold">Delivery Address:</span>
                            <p className="text-cocoa-muted mt-0.5">{order.delivery_address}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <User size={16} className="text-sage mt-0.5 shrink-0" />
                          <div>
                            <span className="font-bold">Customer Details:</span>
                            <p className="text-cocoa-muted mt-0.5">{order.customer_name} ({order.customer_phone})</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <ShoppingBag size={16} className="text-sage mt-0.5 shrink-0" />
                          <div>
                            <span className="font-bold">Items to Deliver:</span>
                            <ul className="text-cocoa-muted list-disc pl-4 mt-0.5 space-y-0.5">
                              {order.items.map((item, idx) => (
                                <li key={idx}>
                                  {item.quantity}x {item.name} ({item.size_label})
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {order.delivery_notes && (
                          <div className="bg-amber-50/60 border border-amber-200/40 p-2.5 rounded-xl text-[10px] font-sans text-cocoa-muted">
                            <span className="font-bold text-amber-cafe block uppercase tracking-wider mb-0.5">Delivery Notes:</span>
                            {order.delivery_notes}
                          </div>
                        )}
                      </div>

                      {/* Navigation Trigger */}
                      <div className="flex gap-2">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address || '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-cream-200 hover:bg-cream-300 border border-linen text-cocoa font-sans text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                        >
                          <Navigation size={13} />
                          Open Map Navigation
                        </a>
                      </div>

                      {/* Status Action Buttons */}
                      {order.delivery_status === 'assigned' ? (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'pickup')}
                          disabled={actionLoading !== null}
                          className="w-full bg-amber-cafe hover:bg-amber-cafe/95 text-white font-sans text-xs font-bold py-3 rounded-xl active:scale-[0.98] transition-all cursor-pointer"
                        >
                          {actionLoading === order.id ? 'Updating...' : 'Confirm Food Pickup'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'deliver')}
                          disabled={actionLoading !== null}
                          className="w-full bg-sage hover:bg-sage-dark text-white font-sans text-xs font-bold py-3 rounded-xl active:scale-[0.98] transition-all cursor-pointer"
                        >
                          {actionLoading === order.id ? 'Updating...' : 'Confirm Delivery to Customer'}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'completed' && (
              <motion.div
                key="completed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {completed.length === 0 ? (
                  <div className="bg-white border border-linen p-8 text-center rounded-2xl shadow-xs">
                    <CheckCircle size={32} className="mx-auto text-linen mb-2" />
                    <p className="font-sans text-xs text-cocoa-muted">You haven't completed any deliveries today yet.</p>
                  </div>
                ) : (
                  completed.map(order => (
                    <div key={order.id} className="bg-white border border-linen rounded-2xl p-5 shadow-xs space-y-3 opacity-90">
                      <div className="flex items-center justify-between border-b border-linen pb-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-sage" />
                          <span className="font-sans text-[10px] text-sage font-bold tracking-widest uppercase">DELIVERED</span>
                        </div>
                        <span className="font-sans text-[10px] text-cocoa-muted">Finished at {formatTime(order.created_at)}</span>
                      </div>

                      <div className="space-y-1 font-sans text-xs text-cocoa">
                        <p className="font-bold">{order.customer_name}</p>
                        <p className="text-cocoa-muted">{order.delivery_address}</p>
                        <p className="text-cocoa-muted text-[11px] mt-1 font-medium">Earnings: Flat Delivery Fee credited</p>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  )
}
