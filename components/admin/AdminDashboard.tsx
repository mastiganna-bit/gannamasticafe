'use client'

import React, { useState, useEffect, useRef, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Order } from '@/lib/types'
import { formatPrice, getExtraCheesePrice, parseAddressText } from '@/lib/utils'
import { CheckCircle, Clock, ChefHat, Package, IndianRupee, Volume2, VolumeX, AlertCircle, RefreshCw, Flame, ShoppingBag, Search, Filter, ChevronDown, ChevronUp, Utensils, Store, Truck, X, Settings } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmCompleteModal from './ConfirmCompleteModal'
import MenuManager from './MenuManager'
import dynamic from 'next/dynamic'

import StoreSettings from './StoreSettings'
const MapComponent = dynamic(() => import('../delivery/MapComponent'), { ssr: false })
const AdminDriversMapComponent = dynamic(() => import('./AdminDriversMapComponent'), { ssr: false })

// Elapsed Time indicator component
function OrderTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)

  useEffect(() => {
    const calculate = () => {
      const diffMs = new Date().getTime() - new Date(createdAt).getTime()
      const diffMins = Math.floor(diffMs / 60000)
      
      if (diffMins === 0) {
        setElapsed('Just now')
        setIsUrgent(false)
      } else {
        setElapsed(`${diffMins} min${diffMins > 1 ? 's' : ''} ago`)
        setIsUrgent(diffMins >= 10) // Highlight red if waiting older than 10 mins
      }
    }

    calculate()
    const interval = setInterval(calculate, 10000)
    return () => clearInterval(interval)
  }, [createdAt])

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-sans font-medium px-2.5 py-1 rounded-full border transition-all ${
      isUrgent 
        ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' 
        : 'bg-cream text-cocoa-muted border-linen/30'
    }`}>
      <Clock size={10} className={isUrgent ? 'animate-spin' : ''} />
      {elapsed}
    </span>
  )
}

export default function AdminDashboard({
  initialOrders,
  completedToday,
}: {
  initialOrders: Order[]
  completedToday: { id: string; total_paise: number }[]
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [completedTodayOrders, setCompletedTodayOrders] = useState(completedToday)
  const [drivers, setDrivers] = useState<Record<string, string>>({})
  const [driverLocations, setDriverLocations] = useState<Record<string, { latitude: number; longitude: number }>>({})
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null)
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [adminSoundEnabled, setAdminSoundEnabled] = useState(false)
  const [dashboardTab, setDashboardTab] = useState<'orders' | 'history' | 'menu' | 'drivers' | 'settings'>('orders')
  const [deliveryProfiles, setDeliveryProfiles] = useState<any[]>([])
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [focusDriverId, setFocusDriverId] = useState<string | null>(null)
  
  // Add Delivery Partner State
  const [newDriverName, setNewDriverName] = useState('')
  const [newDriverPhone, setNewDriverPhone] = useState('')
  const [newDriverVehicle, setNewDriverVehicle] = useState('')
  const [isAddingDriver, setIsAddingDriver] = useState(false)
  const [isOtpStep, setIsOtpStep] = useState(false)
  const [driverOtp, setDriverOtp] = useState('')
  const [verificationId, setVerificationId] = useState('')

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [cheesePrices, setCheesePrices] = useState({
    standard: 2000,
    premiumPizzaSmall: 3000,
    premiumPizzaOther: 5000,
    specialItem: 3000
  })

  const getDriverDetails = (driverId: string | null | undefined) => {
    if (!driverId) return null
    const profile = deliveryProfiles.find(p => p.user_id === driverId)
    if (!profile) return { name: drivers[driverId] || 'Driver', phone: '', vehicle: '' }
    return {
      name: profile.full_name,
      phone: profile.phone,
      vehicle: profile.vehicle_number
    }
  }

  const getItemsSubtotal = (order: Order) => {
    let subtotal = 0
    const items = order.items as any[]
    items.forEach(item => {
      const cheese = item.extra_cheese
        ? (item.extra_cheese_price_paise !== undefined
          ? item.extra_cheese_price_paise
          : getExtraCheesePrice(item.category || '', item.size_label, item.name, cheesePrices))
        : 0
      subtotal += (item.price_paise + cheese) * item.quantity
    })
    return subtotal
  }

  const getPackagingCharges = (order: Order) => {
    let sugarcaneQty = 0
    const items = order.items as any[]
    items.forEach(item => {
      const name = item.name.toLowerCase()
      const category = (item.category || '').toLowerCase()
      const isSugarcane = name.includes('sugarcane') || name.includes('ganna') || category.includes('cane')
      if (isSugarcane) sugarcaneQty += item.quantity
    })
    return sugarcaneQty * 500
  }

  const getTakeawayDiscount = (order: Order) => {
    if (order.delivery_type !== 'takeaway') return 0
    let discount = 0
    const items = order.items as any[]
    items.forEach(item => {
      const name = item.name.toLowerCase()
      const category = (item.category || '').toLowerCase()
      const isSugarcane = name.includes('sugarcane') || name.includes('ganna') || category.includes('cane')
      if (!isSugarcane) {
        const cheese = item.extra_cheese
          ? (item.extra_cheese_price_paise !== undefined
            ? item.extra_cheese_price_paise
            : getExtraCheesePrice(item.category || '', item.size_label, item.name, cheesePrices))
          : 0
        discount += Math.round(0.10 * (item.price_paise + cheese) * item.quantity)
      }
    })
    return discount
  }

  const getOrderCardStyle = (order: Order) => {
    const isFullyDone = order.status === 'completed' && (order.delivery_type !== 'delivery' || order.delivery_status === 'delivered')
    const isReadyAwaitingDelivery = order.status === 'completed' && order.delivery_type === 'delivery' && order.delivery_status !== 'delivered'
    
    if (isFullyDone) {
      // Completed & Delivered -> Soft pastel rose/red
      return 'border-rose-300 bg-rose-50/90 text-rose-900 shadow-sm hover:border-rose-400 opacity-90'
    }
    
    if (isReadyAwaitingDelivery) {
      // Prepared/Ready, but out for delivery/assigned -> Soft pastel purple/indigo
      return 'border-indigo-200 bg-indigo-50/70 text-indigo-900 shadow-sm hover:border-indigo-300'
    }

    switch (order.status) {
      case 'preparing':
        return 'border-amber-200 bg-amber-50/70 text-amber-900 shadow-sm hover:border-amber-300'
      case 'paid':
        return 'border-blue-200 bg-blue-50/70 text-blue-900 shadow-sm hover:border-blue-300'
      case 'cancelled':
        return 'border-slate-200 bg-slate-50/50 text-slate-800 opacity-60'
      default:
        return 'border-linen bg-white text-cocoa hover:border-linen-dark shadow-sm'
    }
  }

  const renderClickableAddress = (text: string | null | undefined) => {
    if (!text) return 'N/A'
    const parts = parseAddressText(text)
    return parts.map((part, i) => {
      if (part.isUrl) {
        return (
          <a
            key={i}
            href={part.content}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sage font-bold underline hover:text-sage-dark break-all inline-flex items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {part.content}
          </a>
        )
      }
      return part.content
    })
  }

  const [historyOrders, setHistoryOrders] = useState<Order[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedHistoryOrderId, setExpandedHistoryOrderId] = useState<string | null>(null)
  const supabase = createClient()

  // Ref to hold latest state for sound subscription callback
  const soundEnabledRef = useRef(adminSoundEnabled)
  useEffect(() => {
    soundEnabledRef.current = adminSoundEnabled
  }, [adminSoundEnabled])

  const todayRevenue = completedTodayOrders.reduce((sum, o) => sum + o.total_paise, 0)

  // Centralized refresh function
  const refreshDashboardData = async () => {
    setIsRefreshing(true)
    try {
      // 1. Fetch all orders created today (from 12 AM onwards)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false })

      if (todayOrders) {
        setOrders(todayOrders as Order[])
      }

      // 2. Fetch completed orders for today
      const { data: completed } = await supabase
        .from('orders')
        .select('id, total_paise')
        .eq('status', 'completed')
        .gte('created_at', todayStart.toISOString())

      if (completed) {
        setCompletedTodayOrders(completed)
      }

      // 3. Fetch delivery profiles mapping
      const { data: driverProfiles } = await supabase
        .from('delivery_profiles')
        .select('*')
      
      if (driverProfiles) {
        setDeliveryProfiles(driverProfiles)
        const mapping = driverProfiles.reduce((acc: any, curr: any) => {
          acc[curr.user_id] = curr.full_name
          return acc
        }, {})
        setDrivers(mapping)
      }

      // 4. Fetch active driver locations
      const { data: locations } = await supabase
        .from('delivery_locations')
        .select('*')
      
      if (locations) {
        const locMap = locations.reduce((acc: any, curr: any) => {
          acc[curr.order_id] = { latitude: Number(curr.latitude), longitude: Number(curr.longitude) }
          return acc
        }, {})
        setDriverLocations(locMap)
      }

      // 5. Fetch system cheese settings
      const { data: systemItem } = await supabase
        .from('menu_items')
        .select('*, menu_item_sizes(*)')
        .eq('id', '00000000-0000-0000-0000-000000000000')
        .single()

      if (systemItem && systemItem.menu_item_sizes) {
        const sizes = systemItem.menu_item_sizes as any[]
        const stdSize = sizes.find(s => s.size_label === 'Standard Price')
        const premSmallSize = sizes.find(s => s.size_label === 'Premium Pizza (Small/Half) Price')
        const premOtherSize = sizes.find(s => s.size_label === 'Premium Pizza (Medium/Large) Price')
        const specSize = sizes.find(s => s.size_label === 'Special Item Price')

        setCheesePrices({
          standard: stdSize ? stdSize.price_paise : 2000,
          premiumPizzaSmall: premSmallSize ? premSmallSize.price_paise : 3000,
          premiumPizzaOther: premOtherSize ? premOtherSize.price_paise : 5000,
          specialItem: specSize ? specSize.price_paise : 3000
        })
      }
    } catch (error) {
      console.error('Error refreshing admin dashboard data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Fetch drivers mapping on load
  useEffect(() => {
    refreshDashboardData()
  }, [])

  // Fetch history when tab is 'history' or filter/search changes
  useEffect(() => {
    if (dashboardTab !== 'history') return

    const delayDebounceFn = setTimeout(() => {
      const fetchOrderHistory = async () => {
        setLoadingHistory(true)
        try {
          let query = supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)

          if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter)
          }

          if (searchTerm.trim()) {
            query = query.or(`customer_name.ilike.%${searchTerm}%,customer_phone.ilike.%${searchTerm}%`)
          }

          const { data, error } = await query
          if (error) throw error
          if (data) {
            setHistoryOrders(data as Order[])
          }
        } catch (err) {
          console.error('Failed to fetch history:', err)
          toast.error('Failed to load order history')
        } finally {
          setLoadingHistory(false)
        }
      }
      fetchOrderHistory()
    }, searchTerm ? 400 : 0)

    return () => clearTimeout(delayDebounceFn)
  }, [dashboardTab, statusFilter, searchTerm, supabase])

  // Synthesizes a beautiful bell chime using Web Audio API as a robust zero-asset fallback
  const playWebAudioChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContext) return
      const ctx = new AudioContext()
      const now = ctx.currentTime
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, start)
        osc.frequency.exponentialRampToValueAtTime(freq * 0.98, start + duration)
        
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.3, start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
        
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + duration)
      }
      
      // Beautiful double chime: G5 (783.99 Hz) then C6 (1046.50 Hz)
      playTone(783.99, now, 0.8)
      playTone(1046.50, now + 0.15, 1.2)
    } catch (e) {
      console.error('Synthesized chime failed:', e)
    }
  }

  // Ring sound chime alert
  const playNewOrderSound = () => {
    const audio = new Audio('/sounds/new-order.mp3')
    audio.play().catch((err) => {
      console.log('Admin sound audio asset play failed, using Web Audio fallback:', err)
      playWebAudioChime()
    })
  }

  // Pre-stage audio permission unlock
  const toggleAdminSound = () => {
    if (!adminSoundEnabled) {
      // Warm up Web Audio context
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContext) {
          const ctx = new AudioContext()
          if (ctx.state === 'suspended') {
            ctx.resume()
          }
        }
      } catch (e) {}

      const audio = new Audio('/sounds/new-order.mp3')
      audio.play().then(() => {
        audio.pause()
        audio.currentTime = 0
        setAdminSoundEnabled(true)
        toast.success('Live kitchen audio alerts enabled!', { icon: '🔊' })
      }).catch(() => {
        // Fallback tone play to verify user can hear it
        playWebAudioChime()
        setAdminSoundEnabled(true)
        toast.success('Sound enabled! Keep tab focused for chimes.', { icon: '🔊' })
      })
    } else {
      setAdminSoundEnabled(false)
      toast.success('Kitchen alerts muted.')
    }
  }

  // 10-second polling interval for bulletproof live updates
  useEffect(() => {
    const interval = setInterval(() => {
      refreshDashboardData()
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  // Real-time new orders webhook with live chimes
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const newOrder = payload.new as Order
          if (newOrder.status === 'paid') {
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === newOrder.id)
              if (!exists) {
                toast.success(`New order from ${newOrder.customer_name}!`, {
                  duration: 8000,
                  icon: '🍔'
                })
                if (soundEnabledRef.current) {
                  playNewOrderSound()
                }
                return [newOrder, ...prev]
              }
              return prev
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const updated = payload.new as Order
          const createdDate = new Date(updated.created_at)
          const todayStart = new Date()
          todayStart.setHours(0, 0, 0, 0)
          const isToday = createdDate.getTime() >= todayStart.getTime()

          if (isToday) {
            setOrders((prev) => {
              const existingOrder = prev.find((o) => o.id === updated.id)
              const statusChangedToPaid = (!existingOrder || existingOrder.status !== 'paid') && updated.status === 'paid'

              if (statusChangedToPaid) {
                toast.success(`New paid order from ${updated.customer_name}!`, {
                  duration: 8000,
                  icon: '🍔'
                })
                if (soundEnabledRef.current) {
                  playNewOrderSound()
                }
              }

              if (existingOrder) {
                return prev.map((o) => (o.id === updated.id ? updated : o))
              } else {
                return [updated, ...prev]
              }
            })
          } else {
            setOrders((prev) => prev.filter((o) => o.id !== updated.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Subscribe to all driver locations in real-time
  useEffect(() => {
    const channel = supabase
      .channel('admin-driver-locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_locations' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const loc = payload.new as any
            setDriverLocations((prev) => ({
              ...prev,
              [loc.order_id]: { latitude: Number(loc.latitude), longitude: Number(loc.longitude) }
            }))
          } else if (payload.eventType === 'DELETE') {
            const loc = payload.old as any
            setDriverLocations((prev) => {
              const copy = { ...prev }
              delete copy[loc.order_id]
              return copy
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const handleMarkPreparing = async (orderId: string) => {
    const res = await fetch('/api/update-order-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, status: 'preparing' }),
    })
    if (res.ok) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'preparing' } : o))
      )
      toast.success('Order preparation started!')
    } else {
      toast.error('Failed to start preparing order.')
    }
  }

  const handleComplete = async () => {
    if (!confirmOrder) return
    setIsCompleting(true)

    const res = await fetch('/api/complete-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: confirmOrder.id }),
    })

    setIsCompleting(false)
    setConfirmOrder(null)

    if (res.ok) {
      if (confirmOrder.delivery_type === 'delivery') {
        // If delivery, keep it on the dashboard but update status to completed (shows it as ready/dispatched/etc.)
        setOrders((prev) =>
          prev.map((o) => (o.id === confirmOrder.id ? { ...o, status: 'completed' } : o))
        )
        toast.success(`Food prepared! Awaiting delivery partner dispatch.`)
      } else {
        // Dine in / takeaway, remove it once completed
        setOrders((prev) => prev.filter((o) => o.id !== confirmOrder.id))
        toast.success(`Order completed! Customer notified.`)
      }
      
      // Refresh completed today counts
      refreshDashboardData()
    } else {
      toast.error('Failed to complete order. Try again.')
    }
  }

  // Calculate Cumulative Kitchen Prep Summary (Active Items totals)
  const getPrepSummary = () => {
    const summary: { [key: string]: number } = {}
    orders.forEach((o) => {
      if (o.status === 'completed' || o.status === 'cancelled') return
      const items = o.items as any[]
      items.forEach((item) => {
        const key = `${item.name} (${item.size_label})`
        summary[key] = (summary[key] || 0) + item.quantity
      })
    })
    return Object.entries(summary).sort((a, b) => b[1] - a[1])
  }
  const prepSummary = getPrepSummary()

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDriverName || !newDriverPhone || !newDriverVehicle) {
      toast.error('All fields are required.')
      return
    }

    setIsAddingDriver(true)
    try {
      const res = await fetch('/api/admin/send-partner-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: newDriverPhone })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP')

      if (data.verificationId) {
        setVerificationId(data.verificationId)
      }

      toast.success('OTP sent to driver via MessageCentral!')
      setIsOtpStep(true)
    } catch (err: any) {
      toast.error(err.message || 'Error sending OTP')
    } finally {
      setIsAddingDriver(false)
    }
  }

  const handleVerifyAndAddDriver = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!driverOtp || !verificationId) {
      toast.error('OTP and Verification ID are required.')
      return
    }

    setIsAddingDriver(true)
    try {
      const res = await fetch('/api/admin/add-partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newDriverName,
          phone: newDriverPhone,
          vehicleNumber: newDriverVehicle,
          otp: driverOtp,
          verificationId
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add driver')

      toast.success('Delivery partner added successfully!')
      setNewDriverName('')
      setNewDriverPhone('')
      setNewDriverVehicle('')
      setDriverOtp('')
      setVerificationId('')
      setIsOtpStep(false)
      
      // Refresh the profiles list
      refreshDashboardData()
    } catch (err: any) {
      toast.error(err.message || 'Error verifying OTP and adding driver')
    } finally {
      setIsAddingDriver(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      
      {/* Admin Tab Controller */}
      <div className="flex flex-wrap gap-2 mb-8 bg-cream-200 p-1 rounded-xl max-w-full sm:max-w-2xl border border-linen">
        <button
          onClick={() => setDashboardTab('orders')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-sans text-xs font-bold transition-all cursor-pointer ${
            dashboardTab === 'orders'
              ? 'bg-sage text-white shadow-sm'
              : 'text-cocoa-muted hover:text-cocoa'
          }`}
        >
          <Package size={14} />
          Live Orders
        </button>
        <button
          onClick={() => setDashboardTab('history')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-sans text-xs font-bold transition-all cursor-pointer ${
            dashboardTab === 'history'
              ? 'bg-sage text-white shadow-sm'
              : 'text-cocoa-muted hover:text-cocoa'
          }`}
        >
          <Clock size={14} />
          Order History
        </button>
        <button
          onClick={() => setDashboardTab('drivers')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-sans text-xs font-bold transition-all cursor-pointer ${
            dashboardTab === 'drivers'
              ? 'bg-sage text-white shadow-sm'
              : 'text-cocoa-muted hover:text-cocoa'
          }`}
        >
          <Truck size={14} />
          Drivers Tracking
        </button>
        <button
          onClick={() => setDashboardTab('menu')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-sans text-xs font-bold transition-all cursor-pointer ${
            dashboardTab === 'menu'
              ? 'bg-sage text-white shadow-sm'
              : 'text-cocoa-muted hover:text-cocoa'
          }`}
        >
          <ShoppingBag size={14} />
          Menu Manager
        </button>
        <button
          onClick={() => setDashboardTab('settings')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-sans text-xs font-bold transition-all cursor-pointer ${
            dashboardTab === 'settings'
              ? 'bg-sage text-white shadow-sm'
              : 'text-cocoa-muted hover:text-cocoa'
          }`}
        >
          <Settings size={14} />
          Settings
        </button>
      </div>

      {dashboardTab === 'orders' && (
        <>
          {/* Sound Controller Alert bar */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-sage/5 border border-sage/20 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-sage/10 p-2 rounded-lg text-sage">
            {adminSoundEnabled ? <Volume2 size={18} className="animate-bounce" /> : <VolumeX size={18} />}
          </div>
          <div>
            <p className="font-sans text-sm font-semibold text-cocoa">Audible Kitchen Alerts</p>
            <p className="font-sans text-xs text-cocoa-muted mt-0.5">Ring automatic chimes immediately when new customers order online!</p>
          </div>
        </div>
        <button
          onClick={toggleAdminSound}
          className={`flex items-center gap-1.5 font-sans text-xs font-semibold py-2 px-4 rounded-lg transition-all duration-300 shadow-sm cursor-pointer ${
            adminSoundEnabled 
              ? 'bg-sage text-cream hover:bg-sage-dark' 
              : 'bg-white text-cocoa hover:bg-cream border border-linen'
          }`}
        >
          {adminSoundEnabled ? '🔔 Chimes Enabled' : '🔇 Muted — Turn On'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Orders', value: orders.length, icon: Package, color: 'text-sage' },
          { label: 'Preparing', value: orders.filter((o) => o.status === 'preparing').length, icon: ChefHat, color: 'text-amber-cafe' },
          { label: "Completed Today", value: completedTodayOrders.length, icon: CheckCircle, color: 'text-sage' },
          { label: "Today's Revenue", value: formatPrice(todayRevenue), icon: IndianRupee, color: 'text-amber-cafe' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-linen rounded-xl2 p-5 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <stat.icon size={18} className={stat.color} />
            </div>
            <p className="font-serif text-2xl text-cocoa font-light">{stat.value}</p>
            <p className="font-sans text-xs text-cocoa-muted mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Cumulative Prep Checklist Section (Chef Summary) */}
      {orders.length > 0 && (
        <div className="bg-white border border-linen rounded-xl2 p-5 shadow-card mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-amber-pale p-1.5 rounded-lg text-amber-cafe">
              <Flame size={16} />
            </div>
            <div>
              <h3 className="font-display text-base text-cocoa">Cumulative Kitchen Prep Checklist</h3>
              <p className="font-sans text-[10px] text-cocoa-muted">Cumulative counts of all active items to prepare across all orders right now.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {prepSummary.map(([itemName, count]) => (
              <div key={itemName} className="bg-cream/40 border border-linen/50 rounded-xl p-3 flex items-center justify-between gap-2 shadow-sm">
                <span className="font-sans text-xs font-medium text-cocoa leading-tight pr-1 truncate" title={itemName}>
                  {itemName}
                </span>
                <span className="bg-sage text-cream text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm animate-pulse-soft">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders Grid */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl text-cocoa">Live Orders</h2>
            <div className="flex items-center gap-1.5 bg-sage/10 text-sage px-2.5 py-1 rounded-full text-[10px] font-sans font-medium tracking-wide">
              <span className="w-1.5 h-1.5 bg-sage rounded-full animate-ping shrink-0" />
              <span>LIVE AUTO-REFRESH</span>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={refreshDashboardData}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans text-cocoa hover:text-sage hover:bg-sage/10 bg-white border border-linen rounded-lg shadow-sm transition-all duration-300 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
            {orders.length === 0 && (
              <span className="font-sans text-xs text-sage bg-sage/10 px-3 py-1 rounded-full">
                All clear
              </span>
            )}
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white border border-linen rounded-xl2 p-12 text-center shadow-card">
            <CheckCircle size={40} className="text-linen mx-auto mb-4" />
            <p className="font-display text-xl text-cocoa mb-1">No pending orders</p>
            <p className="font-sans text-sm text-cocoa-muted">New orders will appear here in real-time</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <AnimatePresence>
              {orders.map((order) => {
                const isExpanded = expandedOrderId === order.id
                const subtotal = getItemsSubtotal(order)
                const packaging = getPackagingCharges(order)
                const discount = getTakeawayDiscount(order)
                const deliveryCharges = order.delivery_type === 'delivery' ? (subtotal < 29900 ? 5000 : 0) : 0
                const driverInfo = getDriverDetails(order.delivery_boy_id)

                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: -16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    className={`border-2 rounded-xl2 p-5 flex flex-col justify-between transition-all duration-300 cursor-pointer ${getOrderCardStyle(order)}`}
                  >
                    <div>
                      {/* Order Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-display text-base text-cocoa leading-snug">{order.customer_name}</p>
                          <p className="font-sans text-[11px] text-cocoa-muted">{order.customer_phone}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-sans font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            order.status === 'completed' && order.delivery_status === 'delivered'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : order.status === 'completed'
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : order.status === 'preparing'
                              ? 'bg-amber-100 text-amber-805 border border-amber-200'
                              : order.status === 'cancelled'
                              ? 'bg-slate-100 text-slate-700 border border-slate-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                            {order.status === 'preparing' ? (
                              <><ChefHat size={10} /> Preparing</>
                            ) : order.status === 'completed' && order.delivery_status === 'delivered' ? (
                              <><CheckCircle size={10} /> Delivered</>
                            ) : order.status === 'completed' ? (
                              <><CheckCircle size={10} /> Ready/Done</>
                            ) : order.status === 'cancelled' ? (
                              <>Cancelled</>
                            ) : (
                              <><Clock size={10} /> Paid</>
                            )}
                          </span>
                          
                          {/* Timer */}
                          <div onClick={(e) => e.stopPropagation()}>
                            <OrderTimer createdAt={order.created_at} />
                          </div>
                        </div>
                      </div>

                      {/* Delivery Type Badge Row */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-sans font-bold px-2 py-0.5 rounded-md ${
                          order.delivery_type === 'delivery'
                            ? 'bg-sage/10 text-sage border border-sage/10'
                            : order.delivery_type === 'dine_in'
                            ? 'bg-amber-cafe/10 text-amber-cafe border border-amber-cafe/10'
                            : 'bg-cocoa-muted/10 text-cocoa border border-linen'
                        }`}>
                          {order.delivery_type === 'delivery' ? '🛵 Home Delivery' : order.delivery_type === 'dine_in' ? '🍽️ Dine In' : '🛍️ Takeaway'}
                        </span>
                        {order.delivery_type === 'dine_in' && order.delivery_address && (
                          <span className="text-[10px] font-sans font-bold text-amber-cafe">
                            Table: {order.delivery_address}
                          </span>
                        )}
                      </div>

                      {/* Items Summary (Always Visible) */}
                      <div className="text-[11px] font-sans text-cocoa-muted mb-2">
                        {order.items.map((it: any) => `${it.name} (${it.size_label}) x${it.quantity}`).join(', ')}
                      </div>

                      {/* Chevron Indicator */}
                      <div className="flex justify-center py-1 text-cocoa-muted/60">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>

                      {/* Accordion Expansion Drawer */}
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 pt-4 border-t border-linen space-y-4 cursor-default"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Complete items breakdown */}
                          <div>
                            <p className="font-sans text-[10px] font-bold text-cocoa-muted uppercase tracking-wider mb-2">Order Items</p>
                            <div className="space-y-2 bg-cream/30 p-3 rounded-xl border border-linen/50">
                              {(order.items as Array<{ name: string; size_label: string; quantity: number; price_paise: number; extra_cheese?: boolean; extra_cheese_price_paise?: number; category?: string }>)
                                .map((item, i) => {
                                  const extraPrice = item.extra_cheese
                                    ? (item.extra_cheese_price_paise !== undefined
                                      ? item.extra_cheese_price_paise
                                      : getExtraCheesePrice(item.category || '', item.size_label, item.name, cheesePrices))
                                    : 0
                                  return (
                                    <div key={i} className="space-y-0.5 text-xs font-sans">
                                      <div className="flex justify-between">
                                        <span className="text-cocoa font-medium">
                                          {item.name} <span className="text-cocoa-muted">({item.size_label})</span> × {item.quantity}
                                        </span>
                                        <span className="text-amber-cafe font-semibold">
                                          {formatPrice((item.price_paise + extraPrice) * item.quantity)}
                                        </span>
                                      </div>
                                      {item.extra_cheese && (
                                        <div className="text-[10px] text-sage font-bold pl-2 flex items-center gap-0.5">
                                          + Extra Cheese (+{formatPrice(extraPrice)})
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                            </div>
                          </div>

                          {/* Swiggy Style Breakdown */}
                          <div>
                            <p className="font-sans text-[10px] font-bold text-cocoa-muted uppercase tracking-wider mb-2">Billing Receipt</p>
                            <div className="space-y-1.5 text-xs font-sans bg-cream/10 p-3 rounded-xl border border-linen">
                              <div className="flex justify-between text-cocoa-muted">
                                <span>Items Subtotal</span>
                                <span>{formatPrice(subtotal)}</span>
                              </div>
                              {packaging > 0 && (
                                <div className="flex justify-between text-cocoa-muted">
                                  <span>Cane Packaging Charges</span>
                                  <span>{formatPrice(packaging)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-cocoa-muted">
                                <span>Platform Fee</span>
                                <span>₹6</span>
                              </div>
                              {discount > 0 && (
                                <div className="flex justify-between text-sage font-semibold">
                                  <span>10% Takeaway Discount</span>
                                  <span>-{formatPrice(discount)}</span>
                                </div>
                              )}
                              {order.delivery_type === 'delivery' && (
                                <div className="flex justify-between text-cocoa-muted">
                                  <span>Delivery Fee</span>
                                  <span>{deliveryCharges > 0 ? formatPrice(deliveryCharges) : 'FREE'}</span>
                                </div>
                              )}
                              <div className="border-t border-linen pt-2 mt-1 flex justify-between font-bold text-cocoa text-sm">
                                <span>Total Paid</span>
                                <span className="text-amber-cafe">{formatPrice(order.total_paise)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Instructions */}
                          {order.notes && (
                            <div className="bg-cream p-3 rounded-xl border border-linen text-xs font-sans text-cocoa">
                              <p className="font-bold text-cocoa-muted text-[10px] uppercase tracking-wider mb-1">Kitchen Notes</p>
                              <p className="italic">"{order.notes}"</p>
                            </div>
                          )}

                          {/* Order IDs & Payments */}
                          <div className="text-[10px] font-mono text-cocoa-muted space-y-0.5 bg-cream/10 p-2.5 rounded-lg border border-linen/50">
                            <p className="truncate">Razorpay ID: {order.razorpay_order_id}</p>
                            <p className="truncate">Payment ID: {order.razorpay_payment_id || 'Awaiting Sync'}</p>
                          </div>

                          {/* Address / Table / Pickup Info */}
                          <div>
                            <p className="font-sans text-[10px] font-bold text-cocoa-muted uppercase tracking-wider mb-2">
                              {order.delivery_type === 'delivery' ? 'Delivery Destination' : order.delivery_type === 'dine_in' ? 'Dine In Info' : 'Takeaway Location'}
                            </p>
                            <div className="bg-cream/20 border border-linen rounded-xl p-3 text-xs font-sans text-cocoa">
                              {order.delivery_type === 'delivery' ? (
                                <div className="space-y-1">
                                  <div className="font-medium text-cocoa break-words">
                                    {renderClickableAddress(order.delivery_address)}
                                  </div>
                                  {order.delivery_notes && (
                                    <div className="text-[10px] text-cocoa-muted italic mt-1 bg-white/50 p-1.5 rounded border border-linen/30">
                                      Landmark: {order.delivery_notes}
                                    </div>
                                  )}
                                </div>
                              ) : order.delivery_type === 'dine_in' ? (
                                <p>Table Order: Customer will receive service at Table <strong>{order.delivery_address || 'N/A'}</strong></p>
                              ) : (
                                <p>Self-Pickup: Customer will collect food directly at the counter.</p>
                              )}
                            </div>
                          </div>

                          {/* Delivery Partner Tracking */}
                          {order.delivery_type === 'delivery' && (
                            <div className="border-t border-linen pt-3 space-y-2">
                              <p className="font-sans text-[10px] font-bold text-cocoa-muted uppercase tracking-wider">Logistics & Driver</p>
                              <div className="bg-cream/40 border border-linen/50 rounded-xl p-3 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-1.5 font-sans text-[10px] font-bold">
                                  <div className="flex flex-wrap gap-1.5">
                                    {order.delivery_status === 'unassigned' && (
                                      <span className="bg-amber-pale border border-amber-cafe/25 text-amber-cafe px-2.5 py-1 rounded-full uppercase tracking-wider">
                                        🛵 Unassigned
                                      </span>
                                    )}
                                    {order.delivery_status === 'assigned' && (
                                      <span className="bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                        🛵 Assigned to {driverInfo?.name || 'Driver'}
                                      </span>
                                    )}
                                    {order.delivery_status === 'picked_up' && (
                                      <span className="bg-sage/15 border border-sage/20 text-sage-dark px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
                                        🛵 Out for Delivery
                                      </span>
                                    )}
                                    {order.delivery_status === 'delivered' && (
                                      <span className="bg-sage text-cream px-2.5 py-1 rounded-full uppercase tracking-wider">
                                        🛵 Delivered
                                      </span>
                                    )}
                                  </div>

                                  {order.delivery_status === 'picked_up' && (
                                    <button
                                      onClick={() => setTrackingOrderId(trackingOrderId === order.id ? null : order.id)}
                                      className="text-[10px] text-sage hover:underline font-bold tracking-wide cursor-pointer focus:outline-none"
                                    >
                                      {trackingOrderId === order.id ? 'Hide GPS Map' : 'Track GPS Location'}
                                    </button>
                                  )}
                                </div>

                                {driverInfo && order.delivery_status !== 'unassigned' && (
                                  <div className="text-[11px] font-sans text-cocoa space-y-0.5 border-t border-linen/50 pt-2 mt-2">
                                    <p><strong>Name:</strong> {driverInfo.name}</p>
                                    {driverInfo.phone && <p><strong>Phone:</strong> {driverInfo.phone}</p>}
                                    {driverInfo.vehicle && <p><strong>Vehicle:</strong> {driverInfo.vehicle}</p>}
                                  </div>
                                )}

                                {order.delivery_status === 'picked_up' && trackingOrderId === order.id && (
                                  <div className="mt-2 overflow-hidden rounded-xl border border-linen shadow-sm bg-cream/30 p-1">
                                    {driverLocations[order.id] ? (
                                      <MapComponent
                                        latitude={driverLocations[order.id].latitude}
                                        longitude={driverLocations[order.id].longitude}
                                      />
                                    ) : (
                                      <div className="p-4 text-center font-sans text-[10px] text-cocoa-muted italic">
                                        Waiting for driver GPS stream...
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>

                    {/* Always visible Footer & Action triggers */}
                    <div className="mt-4 pt-3 border-t border-linen" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-sans text-[10px] text-cocoa-muted">Ordered at {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="font-sans font-bold text-cocoa text-sm">{formatPrice(order.total_paise)}</span>
                      </div>

                      <div className="flex gap-2">
                        {order.status === 'paid' ? (
                          <button
                            onClick={() => handleMarkPreparing(order.id)}
                            className="btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5 bg-amber-cafe hover:bg-amber-light border-amber-cafe/20 text-cream cursor-pointer"
                          >
                            <ChefHat size={14} />
                            Start Preparing
                          </button>
                        ) : order.status === 'preparing' ? (
                          <button
                            onClick={() => setConfirmOrder(order)}
                            className="btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle size={14} />
                            Mark Food Ready
                          </button>
                        ) : (
                          <div className="w-full bg-cream text-cocoa-muted font-sans text-[10px] font-bold py-2.5 rounded-xl border border-linen text-center uppercase tracking-wider">
                            {order.delivery_type === 'delivery' ? (
                              order.delivery_status === 'unassigned'
                                ? 'Awaiting Driver Accept'
                                : order.delivery_status === 'assigned'
                                ? 'Awaiting Driver Pickup'
                                : order.delivery_status === 'picked_up'
                                ? 'Out for Delivery (Live)'
                                : 'Delivered & Completed'
                            ) : (
                              'Completed & Closed'
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

          {/* Settings Tab */}
      {dashboardTab === 'settings' && (
        <StoreSettings />
      )}

      {/* Confirmation Modal */}
          <ConfirmCompleteModal
            isOpen={!!confirmOrder}
            onClose={() => setConfirmOrder(null)}
            onConfirm={handleComplete}
            isLoading={isCompleting}
            orderId={confirmOrder?.id || ''}
            customerName={confirmOrder?.customer_name || ''}
          />
        </>
      )}

      {dashboardTab === 'history' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-linen rounded-xl2 p-5 shadow-card">
            <div>
              <h2 className="font-display text-2xl text-cocoa">Order History</h2>
              <p className="font-sans text-xs text-cocoa-muted mt-0.5">
                Search and review past orders, check items, totals, and customer details.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              {/* Search input */}
              <div className="relative flex-1 sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cocoa-muted" />
                <input
                  type="text"
                  placeholder="Search name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field pl-9 pr-8 py-2 text-xs"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-muted hover:text-cocoa"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status filter dropdown */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input-field py-2 pl-3 pr-8 text-xs appearance-none bg-white cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="preparing">Preparing</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                </select>
                <Filter size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-muted pointer-events-none" />
              </div>
            </div>
          </div>

          {loadingHistory ? (
            <div className="bg-white border border-linen rounded-xl2 p-12 text-center shadow-card flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-sage/30 border-t-sage rounded-full animate-spin" />
              <p className="font-sans text-sm text-cocoa-muted">Loading past orders...</p>
            </div>
          ) : historyOrders.length === 0 ? (
            <div className="bg-white border border-linen rounded-xl2 p-12 text-center shadow-card">
              <AlertCircle size={40} className="text-linen mx-auto mb-4" />
              <p className="font-display text-xl text-cocoa mb-1">No orders found</p>
              <p className="font-sans text-sm text-cocoa-muted">Try adjusting your filters or search query</p>
            </div>
          ) : (
            <div className="bg-white border border-linen rounded-xl2 overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left font-sans text-xs">
                  <thead>
                    <tr className="bg-cream border-b border-linen text-cocoa font-bold">
                      <th className="p-4 w-32">Date & Time</th>
                      <th className="p-4">Customer Details</th>
                      <th className="p-4 w-28">Type</th>
                      <th className="p-4">Items Summary</th>
                      <th className="p-4 w-24">Total</th>
                      <th className="p-4 w-28">Status</th>
                      <th className="p-4 w-24 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linen/50">
                    {historyOrders.map((order) => {
                      const isExpanded = expandedHistoryOrderId === order.id
                      const orderItems = order.items as any[]
                      const totalItemsCount = orderItems.reduce((sum, item) => sum + item.quantity, 0)
                      const itemsSummary = orderItems.map(item => `${item.name} (${item.size_label}) x${item.quantity}`).join(', ')
                      
                      return (
                        <Fragment key={order.id}>
                          <tr className="hover:bg-cream/20 transition-colors border-b border-linen/30">
                            <td className="p-4 text-cocoa-muted whitespace-nowrap">
                              {new Date(order.created_at).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                              })}, {new Date(order.created_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-cocoa">{order.customer_name}</div>
                              <div className="text-[10px] text-cocoa-muted">{order.customer_phone}</div>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cocoa">
                                {order.delivery_type === 'delivery' ? (
                                  <><Truck size={12} className="text-sage" /> Delivery</>
                                ) : order.delivery_type === 'dine_in' ? (
                                  <><Utensils size={12} className="text-amber-cafe" /> Dine-In</>
                                ) : (
                                  <><Store size={12} className="text-cocoa-muted" /> Pickup</>
                                )}
                              </span>
                            </td>
                            <td className="p-4 max-w-xs truncate text-cocoa-muted" title={itemsSummary}>
                              {itemsSummary}
                            </td>
                            <td className="p-4 font-bold text-cocoa whitespace-nowrap">
                              {formatPrice(order.total_paise)}
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                order.status === 'completed'
                                  ? 'bg-sage/10 text-sage-dark border border-sage-dark/15'
                                  : order.status === 'cancelled'
                                  ? 'bg-red-50 text-red-600 border border-red-200'
                                  : order.status === 'preparing'
                                  ? 'bg-amber-pale text-amber-cafe border border-amber-cafe/15'
                                  : 'bg-cream text-cocoa-muted border border-linen/30'
                              }`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => setExpandedHistoryOrderId(isExpanded ? null : order.id)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-sage hover:text-sage-dark border border-linen bg-white p-1 px-2.5 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer focus:outline-none"
                              >
                                <span>{isExpanded ? 'Hide' : 'View'}</span>
                                <ChevronDown size={10} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Details Row */}
                          {isExpanded && (
                            <tr key={`${order.id}-expanded`} className="bg-cream/10">
                              <td colSpan={7} className="p-4 border-t border-linen/50">
                                <div className="space-y-4 text-xs font-sans text-cocoa">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Items Breakdown */}
                                    <div className="bg-white p-4 rounded-xl border border-linen shadow-sm space-y-2.5">
                                      <h4 className="font-bold text-cocoa border-b border-linen pb-1.5 flex items-center gap-1.5">
                                        <Package size={14} className="text-sage" /> Order Items ({totalItemsCount})
                                      </h4>
                                      <div className="space-y-2">
                                        {orderItems.map((item, i) => {
                                          const extraPrice = item.extra_cheese
                                            ? (item.extra_cheese_price_paise !== undefined
                                              ? item.extra_cheese_price_paise
                                              : getExtraCheesePrice(item.category || '', item.size_label, item.name))
                                            : 0
                                          return (
                                            <div key={i} className="flex justify-between items-start text-xs border-b border-linen/30 pb-1.5 last:border-0 last:pb-0">
                                              <div>
                                                <div className="font-semibold">{item.name}</div>
                                                <div className="text-[10px] text-cocoa-muted flex flex-col leading-tight">
                                                  <span>Size: {item.size_label} · Qty: {item.quantity}</span>
                                                  {item.extra_cheese && (
                                                    <span className="text-[9px] text-sage font-semibold mt-0.5">+ Extra Cheese (+{formatPrice(extraPrice)})</span>
                                                  )}
                                                </div>
                                              </div>
                                              <span className="font-bold text-cocoa">{formatPrice((item.price_paise + extraPrice) * item.quantity)}</span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>

                                    {/* Logistics & Notes */}
                                    <div className="bg-white p-4 rounded-xl border border-linen shadow-sm space-y-2.5 col-span-2">
                                      <h4 className="font-bold text-cocoa border-b border-linen pb-1.5 flex items-center gap-1.5">
                                        <AlertCircle size={14} className="text-amber-cafe" /> Logistics & Custom Details
                                      </h4>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                        <div className="space-y-2">
                                          <div>
                                            <span className="font-bold block text-[10px] uppercase text-cocoa-muted">Order ID</span>
                                            <span className="font-mono bg-cream px-1.5 py-0.5 rounded text-[10px] select-all">{order.id}</span>
                                          </div>
                                          <div>
                                            <span className="font-bold block text-[10px] uppercase text-cocoa-muted">Razorpay Order ID</span>
                                            <span className="font-mono bg-cream px-1.5 py-0.5 rounded text-[10px] select-all">{order.razorpay_order_id || 'N/A'}</span>
                                          </div>
                                          {order.delivery_type === 'delivery' && (
                                            <div>
                                              <span className="font-bold block text-[10px] uppercase text-cocoa-muted">Delivery Address</span>
                                              <span className="font-medium">{order.delivery_address || 'N/A'}</span>
                                            </div>
                                          )}
                                        </div>

                                        <div className="space-y-2">
                                          <div>
                                            <span className="font-bold block text-[10px] uppercase text-cocoa-muted">Kitchen Notes / Instructions</span>
                                            <span className="italic">{order.notes || 'No instructions provided.'}</span>
                                          </div>
                                          {order.delivery_type === 'delivery' && (
                                            <>
                                              <div>
                                                <span className="font-bold block text-[10px] uppercase text-cocoa-muted">Delivery Driver ID</span>
                                                <span className="font-mono text-[10px]">{order.delivery_boy_id || 'Not assigned'}</span>
                                              </div>
                                              <div>
                                                <span className="font-bold block text-[10px] uppercase text-cocoa-muted">Delivery Status</span>
                                                <span className="font-semibold uppercase text-sage-dark">{order.delivery_status || 'N/A'}</span>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {dashboardTab === 'drivers' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white border border-linen rounded-xl2 p-5 shadow-card">
            <h2 className="font-display text-2xl text-cocoa">Logistics & Drivers Tracking</h2>
            <p className="font-sans text-xs text-cocoa-muted mt-0.5">
              Monitor active delivery agents, see live coordinates stream, and track order dispatch routes in real-time.
            </p>
          </div>

          {/* Add Delivery Partner Card */}
          <div className="bg-white border border-linen rounded-xl2 p-5 shadow-card">
            <h3 className="font-display text-lg text-cocoa mb-3">Add Delivery Partner</h3>
            {isOtpStep ? (
              <form onSubmit={handleVerifyAndAddDriver} className="flex flex-col md:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-sans font-bold text-cocoa uppercase tracking-wider mb-1">Enter OTP sent to driver</label>
                  <input 
                    type="text" 
                    required
                    maxLength={6}
                    value={driverOtp}
                    onChange={e => setDriverOtp(e.target.value)}
                    className="w-full bg-cream border border-linen rounded-xl p-2.5 text-xs text-cocoa focus:outline-none focus:ring-1 focus:ring-sage font-mono tracking-widest font-bold"
                    placeholder="e.g. 123456"
                  />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsOtpStep(false)}
                    className="flex-1 md:flex-none bg-white border border-linen hover:bg-cream text-cocoa font-sans text-xs font-bold py-3 px-6 rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingDriver}
                    className="flex-1 md:flex-none bg-sage hover:bg-sage-dark text-white font-sans text-xs font-bold py-3 px-6 rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                  >
                    {isAddingDriver ? 'Verifying...' : 'Verify & Add'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSendOtp} className="flex flex-col md:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-sans font-bold text-cocoa uppercase tracking-wider mb-1">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={newDriverName}
                    onChange={e => setNewDriverName(e.target.value)}
                    className="w-full bg-cream border border-linen rounded-xl p-2.5 text-xs text-cocoa focus:outline-none focus:ring-1 focus:ring-sage"
                    placeholder="e.g. Rahul Sharma"
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-sans font-bold text-cocoa uppercase tracking-wider mb-1">Phone Number</label>
                  <input 
                    type="tel" 
                    required
                    maxLength={10}
                    value={newDriverPhone}
                    onChange={e => setNewDriverPhone(e.target.value)}
                    className="w-full bg-cream border border-linen rounded-xl p-2.5 text-xs text-cocoa focus:outline-none focus:ring-1 focus:ring-sage"
                    placeholder="e.g. 9876543210"
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-sans font-bold text-cocoa uppercase tracking-wider mb-1">Vehicle Details</label>
                  <input 
                    type="text" 
                    required
                    value={newDriverVehicle}
                    onChange={e => setNewDriverVehicle(e.target.value)}
                    className="w-full bg-cream border border-linen rounded-xl p-2.5 text-xs text-cocoa focus:outline-none focus:ring-1 focus:ring-sage"
                    placeholder="e.g. DL-3C-AB-1234"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAddingDriver}
                  className="w-full md:w-auto bg-sage hover:bg-sage-dark text-white font-sans text-xs font-bold py-3 px-6 rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  {isAddingDriver ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </form>
            )}
          </div>

          {/* Live Map */}
          <div ref={mapContainerRef} className="bg-white border border-linen rounded-xl2 p-5 shadow-card">
            <h3 className="font-display text-lg text-cocoa mb-3">Live Fleet Location Map</h3>
            <AdminDriversMapComponent
              focusDriverId={focusDriverId}
              drivers={(() => {
                const list: any[] = []
                const processed = new Set<string>()

                orders.forEach(order => {
                  if (
                    order.delivery_type === 'delivery' &&
                    order.delivery_boy_id &&
                    driverLocations[order.id]
                  ) {
                    const driverId = order.delivery_boy_id
                    if (processed.has(driverId)) return

                    const profile = deliveryProfiles.find(p => p.user_id === driverId)
                    const coords = driverLocations[order.id]
                    
                    let destLat = order.delivery_lat ? Number(order.delivery_lat) : null
                    let destLng = order.delivery_lng ? Number(order.delivery_lng) : null
                    if (!destLat || !destLng) {
                      const match = order.delivery_address?.match(/q=([-\d.]+),([-\d.]+)/)
                      if (match) {
                        destLat = parseFloat(match[1])
                        destLng = parseFloat(match[2])
                      }
                    }

                    list.push({
                      driverId,
                      driverName: profile?.full_name || drivers[driverId] || 'Agent',
                      vehicleNumber: profile?.vehicle_number || '🛵 Delivery Vehicle',
                      latitude: coords.latitude,
                      longitude: coords.longitude,
                      customerName: order.customer_name,
                      deliveryAddress: order.delivery_address || '',
                      destLat,
                      destLng
                    })
                    processed.add(driverId)
                  }
                })
                return list
              })()}
            />
          </div>

          {/* Roster list */}
          <div className="bg-white border border-linen rounded-xl2 p-5 shadow-card">
            <h3 className="font-display text-lg text-cocoa mb-4">Delivery Agent Directory</h3>
            {deliveryProfiles.length === 0 ? (
              <p className="font-sans text-xs text-cocoa-muted italic">No delivery partners registered yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deliveryProfiles.map((profile) => {
                  const activeAssignment = orders.find(
                    o => o.delivery_boy_id === profile.user_id && o.delivery_type === 'delivery' && o.delivery_status !== 'delivered'
                  )
                  const hasLiveLocation = activeAssignment && driverLocations[activeAssignment.id]
                  const isFocused = focusDriverId === profile.user_id

                  return (
                    <div
                      key={profile.user_id}
                      onClick={() => {
                        setFocusDriverId(isFocused ? null : profile.user_id)
                        if (!isFocused) {
                          mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                        }
                      }}
                      className={`border rounded-xl p-4 transition-all cursor-pointer space-y-3 shadow-sm ${
                        isFocused
                          ? 'border-sage bg-sage/5 ring-2 ring-sage/20'
                          : 'border-linen bg-cream/10 hover:border-linen-dark'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-sans font-bold text-cocoa">{profile.full_name}</h4>
                          <p className="font-sans text-[10px] text-cocoa-muted">Licence Plate: {profile.vehicle_number}</p>
                          <p className="font-sans text-[10px] text-cocoa-muted">Phone: {profile.phone || 'N/A'}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          profile.is_active 
                            ? 'bg-sage/10 text-sage border border-sage/20' 
                            : 'bg-cocoa-muted/10 text-cocoa-muted border border-linen'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${profile.is_active ? 'bg-sage animate-pulse' : 'bg-cocoa-muted'}`} />
                          {profile.is_active ? 'ON DUTY' : 'OFF DUTY'}
                        </span>
                      </div>

                      <div className="border-t border-linen/50 pt-2 text-xs font-sans">
                        {activeAssignment ? (
                          <div className="space-y-1">
                            <span className="font-bold text-amber-cafe block text-[9px] uppercase tracking-wider">Active Assignment</span>
                            <div className="bg-white p-2.5 rounded-lg border border-linen/70 space-y-1">
                              <p className="font-medium">Order for: {activeAssignment.customer_name}</p>
                              <p className="text-[10px] text-cocoa-muted truncate">Address: {activeAssignment.delivery_address}</p>
                              <div className="flex justify-between items-center text-[10px] pt-1">
                                <span className="uppercase font-bold text-sage">Status: {activeAssignment.delivery_status}</span>
                                {hasLiveLocation && (
                                  <span className="text-sage font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-sage rounded-full animate-ping" />
                                    Live GPS Signal Received
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-cocoa-muted italic text-[11px]">No active delivery assignments. Ready for dispatch.</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {dashboardTab === 'menu' && (
        <MenuManager />
      )}

      {dashboardTab === 'settings' && (
        <StoreSettings />
      )}
    </div>
  )
}
