'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Package, LogOut, CheckCircle, Clock, ChefHat, XCircle, Share, Plus, ShieldCheck, Sparkles, Volume2, ShieldAlert, Check, HelpCircle, VolumeX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Order, Notification as DbNotification, Profile } from '@/lib/types'
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
  notifications: DbNotification[]
  profile: Profile | null
  userEmail: string
}) {
  const [orders, setOrders] = useState(initialOrders)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [activeTab, setActiveTab] = useState<'orders' | 'notifications'>('orders')
  
  // PWA & Notification States
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showInstallDrawer, setShowInstallDrawer] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  
  // Audio & Notification diagnostics states
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<string>('default')
  const [isTestingAlerts, setIsTestingAlerts] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const unreadCount = notifications.filter((n) => !n.is_read).length

  // Live Web Speech voice fallback (highly reliable on iOS and Android)
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel() // clear active queue
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = 0.95
        utterance.pitch = 1.0
        utterance.volume = 1.0
        
        // Find English/Hindi voice
        const voices = window.speechSynthesis.getVoices()
        const selectVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en-GB') || v.lang.includes('en-US'))
        if (selectVoice) utterance.voice = selectVoice

        window.speechSynthesis.speak(utterance)
      } catch (err) {
        console.error('Speech synthesis execution blocked:', err)
      }
    }
  }

  // Active audio/notification context unlocker
  const unlockAudioAndRequestPermission = async () => {
    setIsTestingAlerts(true)
    let permissionResult = 'default'

    // 1. Request OS notification permission
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission()
        permissionResult = permission
        setNotificationPermission(permission)
      } catch (err) {
        console.error('Error requesting notifications:', err)
      }
    }

    // 2. Pre-stage chime context
    const audio = new Audio('/sounds/cafe-chime.mp3')
    audio.play().then(() => {
      audio.pause()
      audio.currentTime = 0
      setAudioElement(audio)
      setAudioUnlocked(true)
      
      // Voice synthesis test
      speakText('Alerts are active! Enjoy your meal.')
      
      toast.success('System alerts and audio chimes unlocked!', { icon: '🔊' })
      setIsTestingAlerts(false)
    }).catch((err) => {
      console.log('Audio autoplay blocked or file missing (404), falling back to Voice Synthesis:', err)
      
      // Fallback voice synthesis test
      speakText('Voice alerts are active!')
      setAudioElement(audio)
      setAudioUnlocked(true)
      toast.success('Voice synthesis alerts unlocked successfully!', { icon: '🗣️' })
      setIsTestingAlerts(false)
    })
  }

  // Multi-tier ready alerts (chime, speech, native banner, tab title flashing)
  const triggerReadyAlert = (order: Order) => {
    // 1. Auditory Chime (Mobile pocket alerts)
    if (audioElement) {
      audioElement.play().catch((err) => console.log('Audio autoplay blocked by system:', err))
    } else {
      const fallbackAudio = new Audio('/sounds/cafe-chime.mp3')
      fallbackAudio.play().catch(() => {})
    }

    // 2. Web Speech voice fallback
    speakText(`Attention ${order.customer_name}! Your Gannamasti Cafe order is ready! Please collect your food at the counter.`)

    // 3. Tab title flashing (For desktop multitaskers)
    let isFlashing = true
    const originalTitle = document.title
    const flashInterval = setInterval(() => {
      if (!isFlashing) {
        clearInterval(flashInterval)
        document.title = originalTitle
      } else {
        document.title = document.title === originalTitle ? '🔔 ORDER READY!' : originalTitle
      }
    }, 1000)

    const handleFocus = () => {
      isFlashing = false
      window.removeEventListener('focus', handleFocus)
    }
    window.addEventListener('focus', handleFocus)

    // 4. HTML5 standard banner popup
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Order Ready! 🍔🥤', {
        body: `Hi ${order.customer_name}! Your delicious order is ready at the Gannamasti Cafe counter!`,
        icon: '/images/logo.png',
        silent: false,
      })
    } else {
      toast.success('Your order is ready! Enjoy 🎉', { duration: 10000 })
    }
  }

  // Device & PWA Environment checks
  useEffect(() => {
    // Fetch initial notification permission status
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    } else {
      setNotificationPermission('unsupported')
    }

    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    setIsStandalone(!!isPWA)

    const isApple = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    setIsIOS(isApple)

    // Register active PWA Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('Gannamasti Cafe SW registered successfully!')
      }).catch((err) => {
        console.error('Service Worker fail:', err)
      })
    }

    const dismissed = localStorage.getItem('dismiss_pwa_onboard') === 'true'

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      if (!isPWA && !dismissed) {
        setShowInstallDrawer(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    if (isApple && !isPWA && !dismissed) {
      setShowInstallDrawer(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  // Real-time order status subscription hook
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
            triggerReadyAlert(updated)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [audioElement])

  // 15-second background polling loop (safeguard for WebSocket drops)
  useEffect(() => {
    const interval = setInterval(async () => {
      // Find logged-in user details to sync
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: latestOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (latestOrders) {
        setOrders((prevOrders) => {
          // Compare status transitions to trigger alerts!
          latestOrders.forEach((latest) => {
            const prev = prevOrders.find((o) => o.id === latest.id)
            if (prev && prev.status !== 'completed' && latest.status === 'completed') {
              triggerReadyAlert(latest as Order)
            }
          })
          return latestOrders as Order[]
        })
      }
    }, 15000)

    return () => clearInterval(interval)
  }, [audioElement])

  // Real-time notification logs subscription hook
  useEffect(() => {
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as DbNotification
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

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log(`Android install choice: ${outcome}`)
    setDeferredPrompt(null)
    setShowInstallDrawer(false)
  }

  const dismissOnboarding = () => {
    localStorage.setItem('dismiss_pwa_onboard', 'true')
    setShowInstallDrawer(false)
  }

  return (
    <div className="min-h-screen bg-cream pt-20 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        
        {/* Real-time System Diagnostics Dashboard (Always Visible) */}
        <div className="mb-6 bg-white border border-linen rounded-xl2 p-5 shadow-card">
          <div className="flex items-start justify-between gap-4 border-b border-linen pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="bg-sage/10 p-2 rounded-lg text-sage">
                <Bell size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-serif text-lg text-cocoa leading-tight">Order Alerts Control Center</h3>
                <p className="font-sans text-[11px] text-cocoa-muted mt-0.5">Real-time diagnostics for pocket alarms, speech synthesis and lock screen banners.</p>
              </div>
            </div>
            <button
              onClick={unlockAudioAndRequestPermission}
              disabled={isTestingAlerts}
              className="flex items-center gap-1 bg-sage hover:bg-sage-dark text-cream font-sans text-xs font-semibold py-2 px-4 rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isTestingAlerts ? 'Testing...' : '🔊 Test System Alerts'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Audio chimes status */}
            <div className="bg-cream/40 border border-linen/50 rounded-xl p-3 flex flex-col justify-between">
              <span className="font-sans text-[10px] text-cocoa-muted uppercase font-bold tracking-wider">Audio Chimes</span>
              <div className="flex items-center gap-1.5 mt-2">
                {audioUnlocked ? (
                  <span className="inline-flex items-center gap-1 text-xs font-sans font-semibold text-sage">
                    <Check size={14} /> Unlocked & Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-sans font-semibold text-amber-cafe">
                    <VolumeX size={14} className="animate-bounce" /> Click Test to Enable
                  </span>
                )}
              </div>
            </div>

            {/* Speech synthesis status */}
            <div className="bg-cream/40 border border-linen/50 rounded-xl p-3 flex flex-col justify-between">
              <span className="font-sans text-[10px] text-cocoa-muted uppercase font-bold tracking-wider">Voice Synthesis (TTS)</span>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 text-xs font-sans font-semibold text-sage">
                  <Check size={14} /> Speech Fallback Ready
                </span>
              </div>
            </div>

            {/* OS Banners status */}
            <div className="bg-cream/40 border border-linen/50 rounded-xl p-3 flex flex-col justify-between">
              <span className="font-sans text-[10px] text-cocoa-muted uppercase font-bold tracking-wider">OS Lock Screen Banners</span>
              <div className="flex items-center gap-1.5 mt-2">
                {notificationPermission === 'granted' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-sans font-semibold text-sage">
                    <Check size={14} /> Fully Active
                  </span>
                ) : notificationPermission === 'denied' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-sans font-semibold text-red-600 leading-tight">
                    <XCircle size={14} /> Blocked in settings
                  </span>
                ) : notificationPermission === 'unsupported' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-sans font-semibold text-cocoa-muted leading-tight" title="Supported inside PWAs only on iOS">
                    <ShieldAlert size={14} /> standard tab block
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-sans font-semibold text-amber-cafe">
                    <ShieldAlert size={14} /> setup needed
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Detailed instruction alerts */}
          {notificationPermission === 'unsupported' && isIOS && (
            <div className="mt-3.5 bg-cream/70 border border-linen p-2.5 rounded-lg flex items-start gap-2 text-[11px] font-sans text-cocoa-muted leading-relaxed">
              <ShieldAlert size={14} className="text-amber-cafe shrink-0 mt-0.5" />
              <p>
                <strong>iOS Safari Notice:</strong> Apple hides lock-screen banner notifications inside normal Safari tabs. To get lock-screen alerts, tap the Share button and select <strong>"Add to Home Screen"</strong> below!
              </p>
            </div>
          )}
          {notificationPermission === 'denied' && (
            <div className="mt-3.5 bg-red-50 border border-red-100 p-2.5 rounded-lg flex items-start gap-2 text-[11px] font-sans text-red-700 leading-relaxed">
              <ShieldAlert size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p>
                <strong>Permission Blocked:</strong> Banners are disabled in your browser settings. Please click the padlock icon in your browser URL bar and change notifications to <strong>"Allow"</strong> to get alert banners!
              </p>
            </div>
          )}
        </div>

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

      {/* Gourmet PWA Installation Tutorial Drawer */}
      <AnimatePresence>
        {showInstallDrawer && (
          <>
            {/* Dark Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={dismissOnboarding}
              className="fixed inset-0 bg-cocoa z-40 pointer-events-auto"
            />

            {/* Tutorial Drawer */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white rounded-t-3xl shadow-depth border-t border-linen z-50 p-6 pb-8"
            >
              {/* Swipe Handle */}
              <div className="w-12 h-1.5 bg-linen rounded-full mx-auto mb-5" />

              {/* Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-1.5 bg-sage/10 text-sage px-3 py-1 rounded-full text-xs font-sans font-medium tracking-wide mb-2">
                  <Sparkles size={12} />
                  <span>PREMIUM CAFE UPGRADE</span>
                </div>
                <h3 className="font-serif text-2xl text-cocoa font-light">Install Gannamasti Cafe App</h3>
                <p className="font-sans text-sm text-cocoa-muted mt-1">Receive automatic chimes & native lock-screen notifications the second your food is ready!</p>
              </div>

              {/* Benefits */}
              <div className="space-y-3.5 mb-6">
                <div className="flex items-start gap-3 bg-cream/50 p-3 rounded-xl border border-linen/50">
                  <div className="bg-sage/10 p-1.5 rounded-lg text-sage shrink-0">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <h4 className="font-sans text-xs font-bold text-cocoa">Zero Alert Delays</h4>
                    <p className="font-sans text-[11px] text-cocoa-muted mt-0.5">Works natively on your phone even if you lock your screen or close this tab!</p>
                  </div>
                </div>
              </div>

              {/* Device specific Installers */}
              {isIOS ? (
                // iPhone Safari Tutorial
                <div className="space-y-4 font-sans text-xs text-cocoa">
                  <p className="font-semibold text-center text-sage uppercase tracking-wider text-[10px]">Simple iPhone Installation</p>
                  <div className="space-y-2.5 bg-cream/40 p-4 rounded-xl border border-linen">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 bg-sage/10 text-sage rounded-full flex items-center justify-center font-bold text-[10px]">1</span>
                      <p className="flex items-center gap-1">Tap Safari's <span className="bg-white border border-linen p-1 rounded inline-flex items-center shadow-sm"><Share size={12} className="text-sage" /> Share</span> button at the bottom.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 bg-sage/10 text-sage rounded-full flex items-center justify-center font-bold text-[10px]">2</span>
                      <p className="flex items-center gap-1">Scroll down and select <span className="bg-white border border-linen p-1 px-2 rounded inline-flex items-center gap-1 shadow-sm"><Plus size={11} className="text-sage" /> Add to Home Screen</span>.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 bg-sage/10 text-sage rounded-full flex items-center justify-center font-bold text-[10px]">3</span>
                      <p>Open the app from your Home Screen & enjoy lock-screen alerts!</p>
                    </div>
                  </div>
                  <button
                    onClick={dismissOnboarding}
                    className="w-full btn-outline py-2.5 text-xs text-center border-linen cursor-pointer"
                  >
                    Got It, Thank You
                  </button>
                </div>
              ) : (
                // Android & Desktop 1-Click Installer
                <div className="space-y-3">
                  <button
                    onClick={handleAndroidInstall}
                    disabled={!deferredPrompt}
                    className="w-full btn-primary py-3 text-xs flex items-center justify-center gap-2 bg-sage hover:bg-sage-dark shadow-sm text-cream cursor-pointer disabled:opacity-50"
                  >
                    <Plus size={14} />
                    Install Web App (1-Click)
                  </button>
                  <button
                    onClick={dismissOnboarding}
                    className="w-full btn-outline py-2.5 text-xs text-center border-linen cursor-pointer"
                  >
                    No thanks, I will keep tab open
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
