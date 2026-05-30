'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Order } from '@/lib/types'
import { formatPrice, getExtraCheesePrice } from '@/lib/utils'
import { CheckCircle, Clock, ChefHat, Package, IndianRupee, Volume2, VolumeX, AlertCircle, RefreshCw, Flame } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmCompleteModal from './ConfirmCompleteModal'

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
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [adminSoundEnabled, setAdminSoundEnabled] = useState(false)
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
      // 1. Fetch active orders
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['paid', 'preparing'])
        .order('created_at', { ascending: false })

      if (activeOrders) {
        setOrders(activeOrders as Order[])
      }

      // 2. Fetch completed orders for today
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { data: completed } = await supabase
        .from('orders')
        .select('id, total_paise')
        .eq('status', 'completed')
        .gte('created_at', todayStart.toISOString())

      if (completed) {
        setCompletedTodayOrders(completed)
      }
    } catch (error) {
      console.error('Error refreshing admin dashboard data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Ring sound chime alert
  const playNewOrderSound = () => {
    const audio = new Audio('/sounds/new-order.mp3')
    audio.play().catch((err) => {
      console.log('Admin sound autoplay blocked by browser context.', err)
    })
  }

  // Pre-stage audio permission unlock
  const toggleAdminSound = () => {
    if (!adminSoundEnabled) {
      const audio = new Audio('/sounds/new-order.mp3')
      audio.play().then(() => {
        audio.pause()
        audio.currentTime = 0
        setAdminSoundEnabled(true)
        toast.success('Live kitchen audio alerts enabled!', { icon: '🔊' })
      }).catch(() => {
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
            setOrders((prev) => [newOrder, ...prev])
            toast.success(`New order from ${newOrder.customer_name}!`, {
              duration: 8000,
              icon: '🍔'
            })
            // Trigger auditory kitchen chime if enabled
            if (soundEnabledRef.current) {
              playNewOrderSound()
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const updated = payload.new as Order
          if (updated.status === 'paid' || updated.status === 'preparing') {
            setOrders((prev) =>
              prev.map((o) => (o.id === updated.id ? updated : o))
            )
          } else if (updated.status === 'completed' || updated.status === 'cancelled') {
            setOrders((prev) => prev.filter((o) => o.id !== updated.id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

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
      setOrders((prev) => prev.filter((o) => o.id !== confirmOrder.id))
      toast.success(`Order completed! Customer notified`)
    } else {
      toast.error('Failed to complete order. Try again.')
    }
  }

  // Calculate Cumulative Kitchen Prep Summary (Active Items totals)
  const getPrepSummary = () => {
    const summary: { [key: string]: number } = {}
    orders.forEach((o) => {
      const items = o.items as any[]
      items.forEach((item) => {
        const key = `${item.name} (${item.size_label})`
        summary[key] = (summary[key] || 0) + item.quantity
      })
    })
    return Object.entries(summary).sort((a, b) => b[1] - a[1])
  }
  const prepSummary = getPrepSummary()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      
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
              {orders.map((order) => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: -16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="bg-white border border-linen rounded-xl2 p-5 shadow-card flex flex-col justify-between"
                >
                  <div>
                    {/* Order Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-display text-base text-cocoa leading-snug">{order.customer_name}</p>
                        <p className="font-sans text-[11px] text-cocoa-muted">{order.customer_phone}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 text-xs font-sans font-medium px-2.5 py-0.5 rounded-full ${
                          order.status === 'preparing'
                            ? 'bg-amber-pale text-amber-cafe border border-amber-cafe/15'
                            : 'bg-sage/10 text-sage border border-sage/15'
                        }`}>
                          {order.status === 'preparing' ? (
                            <><ChefHat size={10} /> Preparing</>
                          ) : (
                            <><Clock size={10} /> Paid</>
                          )}
                        </span>
                        
                        {/* Waiting Timer */}
                        <div className="mt-1.5 flex justify-end">
                          <OrderTimer createdAt={order.created_at} />
                        </div>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-2 mb-4 pb-4 border-b border-linen">
                      {(order.items as Array<{ name: string; size_label: string; quantity: number; price_paise: number; extra_cheese?: boolean; category?: string }>)
                        .map((item, i) => {
                          const extraPrice = item.extra_cheese ? getExtraCheesePrice(item.category || '', item.size_label) : 0
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

                    {/* Notes if any */}
                    {order.notes && (
                      <div className="mb-4 bg-cream p-2.5 rounded-lg border border-linen text-xs font-sans text-cocoa">
                        <div className="flex items-center gap-1 font-semibold text-cocoa-muted mb-0.5">
                          <AlertCircle size={12} className="text-amber-cafe" />
                          <span>Instructions:</span>
                        </div>
                        <p className="italic">{order.notes}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    {/* Total Price and Timestamp footer */}
                    <div className="border-t border-linen pt-3 mb-4 flex justify-between items-center">
                      <span className="font-sans text-xs text-cocoa-muted">Ordered at {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="font-sans font-bold text-cocoa">{formatPrice(order.total_paise)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {order.status === 'paid' ? (
                        <button
                          onClick={() => handleMarkPreparing(order.id)}
                          className="btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5 bg-amber-cafe hover:bg-amber-light border-amber-cafe/20 text-cream cursor-pointer"
                        >
                          <ChefHat size={14} />
                          Start Preparing
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmOrder(order)}
                          className="btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle size={14} />
                          Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmCompleteModal
        isOpen={!!confirmOrder}
        onClose={() => setConfirmOrder(null)}
        onConfirm={handleComplete}
        isLoading={isCompleting}
        orderId={confirmOrder?.id || ''}
        customerName={confirmOrder?.customer_name || ''}
      />
    </div>
  )
}
