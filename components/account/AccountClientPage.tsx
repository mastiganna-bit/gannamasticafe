'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, Package, LogOut, CheckCircle, Clock, ChefHat, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Order, Notification, Profile } from '@/lib/types'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, color: 'text-amber-cafe', bg: 'bg-amber-pale' },
  paid: { label: 'Confirmed', icon: CheckCircle, color: 'text-sage', bg: 'bg-sage/10' },
  preparing: { label: 'Preparing', icon: ChefHat, color: 'text-sage', bg: 'bg-sage/10' },
  completed: { label: 'Ready!', icon: CheckCircle, color: 'text-sage-dark', bg: 'bg-sage/20' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-cocoa-muted', bg: 'bg-linen' },
}

export default function AccountClientPage({
  orders: initialOrders,
  notifications: initialNotifications,
  profile,
  userEmail,
}: {
  orders: Order[]
  notifications: Notification[]
  profile: Profile | null
  userEmail: string
}) {
  const [orders, setOrders] = useState(initialOrders)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [activeTab, setActiveTab] = useState<'orders' | 'notifications'>('orders')
  const supabase = createClient()
  const router = useRouter()

  const unreadCount = notifications.filter((n) => !n.is_read).length

  // Real-time order updates
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const updated = payload.new as Order
          setOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? updated : o))
          )
          if (updated.status === 'completed') {
            toast.success('Your order is ready! Come pick it up', { duration: 6000 })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Real-time notifications
  useEffect(() => {
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as Notification
          setNotifications((prev) => [newNotif, ...prev])
          toast.success(newNotif.title, { duration: 5000 })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    toast.success('Signed out successfully')
  }

  return (
    <div className="min-h-screen bg-cream pt-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="font-sans text-xs text-sage font-medium uppercase tracking-widest mb-1">
              Welcome back
            </p>
            <h1 className="font-serif text-3xl text-cocoa font-light">
              {profile?.full_name || userEmail.split('@')[0]}
            </h1>
            <p className="font-sans text-xs text-cocoa-muted mt-1">{userEmail}</p>
            {profile?.is_admin && (
              <div className="mt-3">
                <a
                  href="/admin"
                  className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 py-1.5 px-3.5 rounded-full transition-all tracking-wide shadow-sm"
                >
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse" />
                  Access Admin Panel →
                </a>
              </div>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 font-sans text-xs text-cocoa-muted hover:text-cocoa transition-colors py-2 px-3 rounded-lg hover:bg-cream-200"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-cream-200 p-1 rounded-xl">
          {[
            { key: 'orders', label: 'My Orders', icon: Package },
            { key: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'orders' | 'notifications')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-sans text-sm font-medium transition-all',
                activeTab === tab.key
                  ? 'bg-white text-cocoa shadow-sm'
                  : 'text-cocoa-muted hover:text-cocoa'
              )}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className="bg-sage text-cream text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="text-center py-16">
                <Package size={32} className="text-linen mx-auto mb-3" />
                <p className="font-display text-xl text-cocoa mb-1">No orders yet</p>
                <p className="font-sans text-sm text-cocoa-muted mb-6">
                  Place your first order from our menu
                </p>
                <a href="/menu" className="btn-primary text-sm">Browse Menu</a>
              </div>
            ) : (
              orders.map((order) => {
                const status = STATUS_CONFIG[order.status]
                const StatusIcon = status.icon
                const items = order.items as Array<{ name: string; size_label: string; quantity: number; price_paise: number }>

                return (
                  <motion.div
                    key={order.id}
                    layout
                    className="bg-white border border-linen rounded-xl2 p-5 shadow-card"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-sans text-xs text-cocoa-muted">
                          {new Date(order.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                        <p className="font-sans text-xs text-cocoa-muted mt-0.5">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                      <span className={cn('flex items-center gap-1.5 text-xs font-sans font-medium px-2.5 py-1 rounded-full', status.bg, status.color)}>
                        <StatusIcon size={11} />
                        {status.label}
                      </span>
                    </div>

                    <div className="space-y-1.5 mb-3">
                      {items.slice(0, 3).map((item, i) => (
                        <div key={i} className="flex justify-between text-xs font-sans">
                          <span className="text-cocoa">
                            {item.name} <span className="text-cocoa-muted">({item.size_label})</span> × {item.quantity}
                          </span>
                          <span className="text-amber-cafe font-medium">
                            {formatPrice(item.price_paise * item.quantity)}
                          </span>
                        </div>
                      ))}
                      {items.length > 3 && (
                        <p className="text-xs text-cocoa-muted">+{items.length - 3} more items</p>
                      )}
                    </div>

                    <div className="border-t border-linen pt-3 flex justify-between items-center">
                      <span className="font-sans text-xs text-cocoa-muted">Total</span>
                      <span className="font-sans font-bold text-cocoa">{formatPrice(order.total_paise)}</span>
                    </div>

                    {order.status === 'completed' && (
                      <div className="mt-3 bg-sage/10 rounded-lg px-3 py-2 flex items-center gap-2">
                        <CheckCircle size={14} className="text-sage" />
                        <p className="font-sans text-xs text-sage font-medium">Order completed! Enjoy 🎉</p>
                      </div>
                    )}
                  </motion.div>
                )
              })
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div>
            {notifications.length > 0 && unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="mb-4 font-sans text-xs text-sage hover:text-sage-dark transition-colors"
              >
                Mark all as read
              </button>
            )}
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <div className="text-center py-16">
                  <Bell size={32} className="text-linen mx-auto mb-3" />
                  <p className="font-display text-xl text-cocoa mb-1">No notifications</p>
                  <p className="font-sans text-sm text-cocoa-muted">
                    You'll be notified when your order is ready
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'bg-white border rounded-xl p-4',
                      notif.is_read ? 'border-linen' : 'border-sage/30 bg-sage/5'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {!notif.is_read && (
                        <div className="w-2 h-2 bg-sage rounded-full shrink-0 mt-1.5" />
                      )}
                      <div className={cn(!notif.is_read ? '' : 'ml-5')}>
                        <p className="font-sans text-sm font-medium text-cocoa">{notif.title}</p>
                        <p className="font-sans text-xs text-cocoa-muted mt-0.5">{notif.message}</p>
                        <p className="font-sans text-xs text-cocoa-muted mt-1.5">
                          {new Date(notif.created_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
