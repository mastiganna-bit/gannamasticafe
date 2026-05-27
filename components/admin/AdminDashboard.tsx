'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Order } from '@/lib/types'
import { formatPrice } from '@/lib/utils'
import { CheckCircle, Clock, ChefHat, Package, IndianRupee } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmCompleteModal from './ConfirmCompleteModal'

export default function AdminDashboard({
  initialOrders,
  completedToday,
}: {
  initialOrders: Order[]
  completedToday: { id: string; total_paise: number }[]
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const supabase = createClient()

  const todayRevenue = completedToday.reduce((sum, o) => sum + o.total_paise, 0)

  // Real-time new orders
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
              icon: '🛎️',
              duration: 5000,
            })
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
      toast.success(`Order completed! Customer notified 🎉`)
    } else {
      toast.error('Failed to complete order. Try again.')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Orders', value: orders.length, icon: Package, color: 'text-sage' },
          { label: 'Preparing', value: orders.filter((o) => o.status === 'preparing').length, icon: ChefHat, color: 'text-amber-cafe' },
          { label: "Completed Today", value: completedToday.length, icon: CheckCircle, color: 'text-sage' },
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

      {/* Orders */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-2xl text-cocoa">Live Orders</h2>
          {orders.length === 0 && (
            <span className="font-sans text-xs text-sage bg-sage/10 px-3 py-1 rounded-full">
              All clear 🎉
            </span>
          )}
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
                  className="bg-white border border-linen rounded-xl2 p-5 shadow-card"
                >
                  {/* Order Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-display text-base text-cocoa">{order.customer_name}</p>
                      <p className="font-sans text-xs text-cocoa-muted">{order.customer_phone}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center gap-1 text-xs font-sans font-medium px-2 py-1 rounded-full ${
                        order.status === 'preparing'
                          ? 'bg-amber-pale text-amber-cafe'
                          : 'bg-sage/10 text-sage'
                      }`}>
                        {order.status === 'preparing' ? (
                          <><ChefHat size={10} /> Preparing</>
                        ) : (
                          <><Clock size={10} /> Paid</>
                        )}
                      </span>
                      <p className="font-sans text-xs text-cocoa-muted mt-1">
                        {new Date(order.created_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-1.5 mb-4 pb-4 border-b border-linen">
                    {(order.items as Array<{ name: string; size_label: string; quantity: number; price_paise: number }>)
                      .map((item, i) => (
                        <div key={i} className="flex justify-between text-xs font-sans">
                          <span className="text-cocoa">
                            {item.name} <span className="text-cocoa-muted">({item.size_label})</span> × {item.quantity}
                          </span>
                          <span className="text-amber-cafe font-semibold">
                            {formatPrice(item.price_paise * item.quantity)}
                          </span>
                        </div>
                      ))}
                  </div>

                  {/* Notes if any */}
                  {order.notes && (
                    <div className="mb-4 bg-cream p-2.5 rounded-lg border border-linen text-xs font-sans text-cocoa">
                      <p className="font-semibold text-cocoa-muted mb-0.5">Notes:</p>
                      <p>{order.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {order.status === 'paid' ? (
                      <button
                        onClick={() => handleMarkPreparing(order.id)}
                        className="btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5 bg-amber-cafe hover:bg-amber-light"
                      >
                        <ChefHat size={14} />
                        Start Preparing
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmOrder(order)}
                        className="btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle size={14} />
                        Mark Completed
                      </button>
                    )}
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
