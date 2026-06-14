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
import dynamic from 'next/dynamic'

const MapComponent = dynamic(() => import('@/components/delivery/MapComponent'), { ssr: false })

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
  
  // Web Push Subscription states
  const [isPushSubscribed, setIsPushSubscribed] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  // State for streaming driver locations
  const [driverLocations, setDriverLocations] = useState<Record<string, { latitude: number; longitude: number }>>({})

  // Subscribe to real-time driver coordinates for out-for-delivery orders
  useEffect(() => {
    const activeDeliveryOrders = orders.filter(
      (o: any) => o.delivery_type === 'delivery' && o.delivery_status === 'picked_up' && ['preparing', 'completed'].includes(o.status)
    )

    if (activeDeliveryOrders.length === 0) return

    // Fetch initial coordinates
    activeDeliveryOrders.forEach(async (order: any) => {
      const { data } = await supabase
        .from('delivery_locations')
        .select('latitude, longitude')
        .eq('order_id', order.id)
        .single()

      if (data) {
        setDriverLocations((prev) => ({
          ...prev,
          [order.id]: { latitude: Number(data.latitude), longitude: Number(data.longitude) }
        }))
      }
    })

    // Setup realtime subscription
    const channels = activeDeliveryOrders.map((order: any) => {
      return supabase
        .channel(`driver-loc-${order.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'delivery_locations',
            filter: `order_id=eq.${order.id}`
          },
          (payload) => {
            if (payload.new && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
              const loc = payload.new as any
              setDriverLocations((prev) => ({
                ...prev,
                [order.id]: { latitude: Number(loc.latitude), longitude: Number(loc.longitude) }
              }))
            } else if (payload.eventType === 'DELETE') {
              setDriverLocations((prev) => {
                const copy = { ...prev }
                delete copy[order.id]
                return copy
              })
            }
          }
        )
        .subscribe()
    })

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch))
    }
  }, [orders, supabase])

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

    const isDelivery = order.delivery_type === 'delivery'
    const voiceMsg = isDelivery
      ? `Attention ${order.customer_name}! Your Gannamasti Cafe order has been prepared and is being packed for delivery.`
      : `Attention ${order.customer_name}! Your Gannamasti Cafe order is ready! Please collect your food at the counter.`

    // 2. Web Speech voice fallback
    speakText(voiceMsg)

    // 3. Tab title flashing (For desktop multitaskers)
    let isFlashing = true
    const originalTitle = document.title
    const flashInterval = setInterval(() => {
      if (!isFlashing) {
        clearInterval(flashInterval)
        document.title = originalTitle
      } else {
        document.title = document.title === originalTitle 
          ? (isDelivery ? '🔔 ORDER PREPARED!' : '🔔 ORDER READY!') 
          : originalTitle
      }
    }, 1000)

    const handleFocus = () => {
      isFlashing = false
      window.removeEventListener('focus', handleFocus)
    }
    window.addEventListener('focus', handleFocus)

    // 4. HTML5 standard banner popup
    if ('Notification' in window && Notification.permission === 'granted') {
      const notificationTitle = isDelivery ? 'Order Prepared! 🍔📦' : 'Order Ready! 🍔🥤'
      const notificationBody = isDelivery
        ? `Hi ${order.customer_name}! Your order has been prepared and is being packed for delivery.`
        : `Hi ${order.customer_name}! Your delicious order is ready at the Gannamasti Cafe counter!`

      new Notification(notificationTitle, {
        body: notificationBody,
        icon: '/images/logo.png',
        silent: false,
      })
    } else {
      const toastMsg = isDelivery 
        ? 'Your order is prepared and packing for delivery! 🎉' 
        : 'Your order is ready! Enjoy 🎉'
      toast.success(toastMsg, { duration: 10000 })
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

  // Check active Web Push Subscription on mount
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsPushSubscribed(!!sub)
        }).catch((err) => {
          console.error('Error checking push subscription:', err)
        })
      })
    }
  }, [])

  const togglePushSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error('Web Push notifications are not supported on this browser.')
      return
    }

    setIsSubscribing(true)
    try {
      const reg = await navigator.serviceWorker.ready

      if (isPushSubscribed) {
        // Unsubscribe
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/push-subscribe', {
            method: 'DELETE',
            body: JSON.stringify({ endpoint: sub.endpoint }),
            headers: { 'Content-Type': 'application/json' },
          })
          await sub.unsubscribe()
        }
        setIsPushSubscribed(false)
        toast.success('Unsubscribed from lock-screen notifications.')
      } else {
        // Subscribe
        // 1. Request notification permissions
        const permission = await Notification.requestPermission()
        setNotificationPermission(permission)

        if (permission !== 'granted') {
          toast.error('Notification permission was denied. Please allow notifications in browser settings.')
          setIsSubscribing(false)
          return
        }

        // 2. Register push subscription
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidPublicKey) {
          throw new Error('VAPID public key missing in environment variables.')
        }

        // Convert base64 VAPID key to Uint8Array
        const convertedKey = urlBase64ToUint8Array(vapidPublicKey)

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        })

        // Convert to standard JSON object explicitly to avoid serialization issues in some browsers
        const subJson = sub.toJSON()
        const payload = {
          endpoint: sub.endpoint || subJson.endpoint,
          keys: {
            auth: subJson.keys?.auth || '',
            p256dh: subJson.keys?.p256dh || ''
          }
        }

        // 3. Save subscription to database
        const res = await fetch('/api/push-subscribe', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
        })

        if (!res.ok) {
          throw new Error('Server rejected push subscription.')
        }

        setIsPushSubscribed(true)
        toast.success('Subscribed to lock-screen notifications!')
      }
    } catch (err) {
      console.error('Push notification toggle error:', err)
      toast.error('Failed to update push subscription settings.')
    } finally {
      setIsSubscribing(false)
    }
  }

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

  // Group orders by activity
  const activeOrders = orders.filter((o) => ['pending', 'paid', 'preparing'].includes(o.status))
  const pastOrders = orders.filter((o) => ['completed', 'cancelled'].includes(o.status))

  return (
    <div className="min-h-screen bg-cream pt-20 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        
        {/* Simple & Premium Notification Alerts Settings */}
        <div className="mb-6 bg-white border border-linen rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="font-serif text-sm font-semibold text-cocoa border-b border-linen pb-2">
            Notification Settings
          </h3>
          
          {/* Audio alerts control */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="bg-amber-50 p-2 rounded-lg text-amber-cafe shrink-0">
                <Volume2 size={16} />
              </div>
              <div>
                <h4 className="font-sans text-xs font-bold text-cocoa">Live Voice & Audio Chimes</h4>
                <p className="font-sans text-[11px] text-cocoa-muted mt-0.5">
                  Announce when your food is ready using voice synthesis.
                </p>
              </div>
            </div>
            <button
              onClick={unlockAudioAndRequestPermission}
              disabled={isTestingAlerts}
              className={cn(
                "font-sans text-xs font-bold py-2 px-4 rounded-lg shadow-xs transition-all cursor-pointer",
                audioUnlocked 
                  ? "bg-sage/10 text-sage border border-sage/20 cursor-default" 
                  : "bg-amber-cafe hover:bg-amber-cafe/95 text-white"
              )}
            >
              {audioUnlocked ? '✓ Active' : '🔊 Turn On Audio'}
            </button>
          </div>

          {/* Web Push Lock Screen alerts control */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-linen/60">
            <div className="flex items-start gap-2.5">
              <div className="bg-sage/10 p-2 rounded-lg text-sage shrink-0">
                <Bell size={16} />
              </div>
              <div>
                <h4 className="font-sans text-xs font-bold text-cocoa">Lock Screen Notifications</h4>
                <p className="font-sans text-[11px] text-cocoa-muted mt-0.5">
                  Get native notifications even when your phone screen is locked or tab is closed.
                </p>
              </div>
            </div>
            <button
              onClick={togglePushSubscription}
              disabled={isSubscribing}
              className={cn(
                "font-sans text-xs font-bold py-2 px-4 rounded-lg shadow-xs transition-all cursor-pointer",
                isPushSubscribed 
                  ? "bg-sage hover:bg-sage-dark text-white" 
                  : "bg-cream-200 hover:bg-cream-300 text-cocoa border border-linen"
              )}
            >
              {isSubscribing ? 'Processing...' : isPushSubscribed ? '✓ Subscribed' : '🔔 Subscribe'}
            </button>
          </div>
        </div>

        {notificationPermission === 'denied' && (
          <div className="mb-6 bg-amber-50/80 border border-amber-200/60 rounded-xl p-4 flex items-start gap-3 shadow-xs">
            <ShieldAlert size={18} className="text-amber-cafe shrink-0 mt-0.5" />
            <div>
              <h4 className="font-sans text-xs font-bold text-cocoa">Lock Screen Banner Blocked</h4>
              <p className="font-sans text-[11px] text-cocoa-muted mt-0.5">
                Notifications are blocked in your browser settings. Please allow notifications in your browser parameters to get lock-screen alerts.
              </p>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-white border border-linen p-5 rounded-2xl shadow-xs">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-sage/10 text-sage flex items-center justify-center font-serif text-lg font-bold shrink-0">
              {(profile?.full_name || userEmail.split('@')[0]).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-sans text-xs text-sage font-medium uppercase tracking-widest">
                Welcome back
              </p>
              <h1 className="font-serif text-xl sm:text-2xl text-cocoa truncate">
                {profile?.full_name || userEmail.split('@')[0]}
              </h1>
              <p className="font-sans text-xs text-cocoa-muted mt-0.5 truncate">{userEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {profile?.is_admin && (
              <a
                href="/admin"
                className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 py-1.5 px-3.5 rounded-full transition-all"
              >
                <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse" />
                Admin Panel
              </a>
            )}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 font-sans text-xs text-cocoa-muted hover:text-cocoa transition-colors py-1.5 px-3 rounded-lg hover:bg-cream-200 border border-linen/60 bg-white"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>

        {/* Tabs navigation */}
        <div className="flex gap-2 mb-6 bg-cream-200 p-1 rounded-xl">
          {[
            { key: 'orders', label: 'My Orders', icon: Package },
            { key: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'orders' | 'notifications')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-sans text-sm font-medium transition-all cursor-pointer',
                activeTab === tab.key
                  ? 'bg-white text-cocoa shadow-sm font-semibold'
                  : 'text-cocoa-muted hover:text-cocoa'
              )}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className="bg-sage text-cream text-xs font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Orders Tab Content */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            
            {/* 1. Active Orders Section */}
            {activeOrders.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-serif text-lg text-cocoa font-medium border-b border-linen/60 pb-2">
                  Active Orders ({activeOrders.length})
                </h3>
                {activeOrders.map((order) => {
                  const status = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending
                  const StatusIcon = status.icon
                  const items = order.items as Array<{ name: string; size_label: string; quantity: number; price_paise: number }>

                  // Steps calculation for Progress Tracker
                  const steps = ['pending', 'paid', 'preparing', 'completed']
                  const currentIndex = steps.indexOf(order.status)

                  return (
                    <motion.div
                      key={order.id}
                      layout
                      className="bg-white border-2 border-sage/20 rounded-2xl p-5 shadow-sm relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-sage/20" />
                      
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="font-sans text-[11px] text-cocoa-muted">
                            Placed on {new Date(order.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                          <p className="font-mono text-xs font-bold text-cocoa mt-0.5 uppercase">
                            #{order.id.slice(0, 8)}
                          </p>
                        </div>
                        <span className={cn('flex items-center gap-1.5 text-xs font-sans font-semibold px-3 py-1 rounded-full border', status.bg, status.color)}>
                          <StatusIcon size={12} className={order.status === 'preparing' ? 'animate-spin' : ''} />
                          {status.label}
                        </span>
                      </div>

                      {/* Dynamic Progress Tracker */}
                      <div className="py-4 my-2 border-y border-linen/50">
                        <div className="relative flex justify-between">
                          <div className="absolute top-2 left-0 right-0 h-0.5 bg-linen -z-10" />
                          <div 
                            className="absolute top-2 left-0 h-0.5 bg-sage transition-all duration-500 -z-10" 
                            style={{ width: `${(Math.max(0, currentIndex) / 3) * 100}%` }}
                          />

                          {steps.map((step, idx) => {
                            const isDone = idx <= currentIndex
                            const isActive = idx === currentIndex
                            return (
                              <div key={step} className="flex flex-col items-center">
                                <div 
                                  className={cn(
                                    "w-4.5 h-4.5 rounded-full flex items-center justify-center border transition-all duration-300 text-[9px] font-bold",
                                    isDone 
                                      ? "bg-sage border-sage text-cream" 
                                      : "bg-white border-linen text-cocoa-muted"
                                  )}
                                >
                                  {isDone ? '✓' : idx + 1}
                                </div>
                                <span 
                                  className={cn(
                                    "text-[10px] font-sans font-medium mt-1.5",
                                    isActive ? "text-sage font-bold" : isDone ? "text-cocoa" : "text-cocoa-muted"
                                  )}
                                >
                                  {step === 'pending' ? 'Pending' : step === 'paid' ? 'Confirmed' : step === 'preparing' ? 'Preparing' : 'Ready'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-2 mt-4">
                        {items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs font-sans">
                            <span className="text-cocoa font-medium">
                              {item.name} <span className="text-cocoa-muted">({item.size_label})</span> × {item.quantity}
                            </span>
                            <span className="text-cocoa font-semibold">
                              {formatPrice(item.price_paise * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-linen/60 pt-3 mt-4 flex justify-between items-center text-xs">
                        <span className="font-sans text-cocoa-muted">Grand Total</span>
                        <span className="font-sans font-bold text-sm text-cocoa">{formatPrice(order.total_paise)}</span>
                      </div>

                      {order.delivery_type === 'delivery' && (
                        <div className="mt-4 pt-4 border-t border-linen/60 space-y-2 font-sans text-xs">
                          {order.delivery_otp && (
                            <div className="bg-sage/10 text-cocoa border border-sage/20 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                              <div>
                                <p className="font-bold text-[10px] text-sage uppercase tracking-wider">Delivery Handover OTP</p>
                                <p className="text-cocoa-muted text-[11px] mt-0.5">Share this code with your driver only when you receive your food.</p>
                              </div>
                              <div className="font-mono text-lg font-bold bg-white text-sage px-4 py-1.5 rounded-lg border border-linen tracking-widest text-center self-center sm:self-auto shrink-0 shadow-xs">
                                {order.delivery_otp}
                              </div>
                            </div>
                          )}

                          {order.delivery_status === 'unassigned' && (
                            <div className="bg-amber-50 text-amber-800 border border-amber-200/50 p-2.5 rounded-xl flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-pulse" />
                              <span>Waiting for a delivery partner to accept your order...</span>
                            </div>
                          )}
                          {order.delivery_status === 'assigned' && (
                            <div className="bg-sage/10 text-sage border border-sage/20 p-2.5 rounded-xl flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-sage rounded-full animate-pulse" />
                              <span>Delivery partner assigned. Preparing for dispatch.</span>
                            </div>
                          )}
                          {order.delivery_status === 'picked_up' && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-sans text-xs font-bold text-sage flex items-center gap-1.5">
                                  <span className="w-2 h-2 bg-sage rounded-full animate-ping" />
                                  Live Order Tracking
                                </span>
                                <span className="font-sans text-[10px] text-cocoa-muted">Scooter is on the way</span>
                              </div>
                              {driverLocations[order.id] ? (
                                <MapComponent 
                                  latitude={driverLocations[order.id].latitude} 
                                  longitude={driverLocations[order.id].longitude} 
                                />
                              ) : (
                                <div className="bg-cream p-4 rounded-xl border border-linen text-center text-[11px] text-cocoa-muted">
                                  Waiting for driver's GPS coordinates...
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}

            {/* 2. Order History / Past Orders */}
            <div className="space-y-4">
              <h3 className="font-serif text-lg text-cocoa font-medium border-b border-linen/60 pb-2">
                Order History ({pastOrders.length})
              </h3>
              
              {orders.length === 0 ? (
                <div className="text-center py-16 bg-white border border-linen rounded-2xl shadow-xs">
                  <Package size={32} className="text-linen mx-auto mb-3" />
                  <p className="font-display text-lg text-cocoa mb-1">No orders yet</p>
                  <p className="font-sans text-sm text-cocoa-muted mb-6">
                    Browse our gourmet selection to place your first order.
                  </p>
                  <a href="/menu" className="btn-primary text-sm px-6 py-2.5">Browse Menu</a>
                </div>
              ) : pastOrders.length === 0 && activeOrders.length > 0 ? (
                <p className="text-xs font-sans text-cocoa-muted text-center py-6 bg-white border border-linen rounded-2xl">
                  No previous completed orders yet.
                </p>
              ) : (
                pastOrders.map((order) => {
                  const status = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.cancelled
                  const StatusIcon = status.icon
                  const items = order.items as Array<{ name: string; size_label: string; quantity: number; price_paise: number }>

                  return (
                    <motion.div
                      key={order.id}
                      className="bg-white border border-linen rounded-xl2 p-4 shadow-card hover:border-linen-dark transition-all duration-300"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-sans text-[11px] text-cocoa-muted">
                            {new Date(order.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </p>
                          <p className="font-mono text-xs text-cocoa-muted mt-0.5">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                        <span className={cn('flex items-center gap-1.5 text-xs font-sans font-medium px-2.5 py-0.5 rounded-full border', status.bg, status.color)}>
                          <StatusIcon size={11} />
                          {status.label}
                        </span>
                      </div>

                      <div className="space-y-1 mb-3">
                        {items.slice(0, 3).map((item, i) => (
                          <div key={i} className="flex justify-between text-xs font-sans">
                            <span className="text-cocoa-muted">
                              {item.name} ({item.size_label}) × {item.quantity}
                            </span>
                            <span className="text-cocoa-muted">
                              {formatPrice(item.price_paise * item.quantity)}
                            </span>
                          </div>
                        ))}
                        {items.length > 3 && (
                          <p className="text-[10px] text-sage font-medium">+ {items.length - 3} more items</p>
                        )}
                      </div>

                      <div className="border-t border-linen pt-2 flex justify-between items-center text-xs">
                        <span className="font-sans text-cocoa-muted">Total</span>
                        <span className="font-sans font-bold text-cocoa">{formatPrice(order.total_paise)}</span>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Notifications Tab Content */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-linen/60 pb-2 mb-4">
              <h3 className="font-serif text-lg text-cocoa font-medium">
                Notification Log
              </h3>
              {notifications.length > 0 && unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="font-sans text-xs text-sage hover:text-sage-dark font-semibold transition-colors cursor-pointer"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="space-y-3">
              {notifications.length === 0 ? (
                <div className="text-center py-16 bg-white border border-linen rounded-2xl shadow-xs">
                  <Bell size={32} className="text-linen mx-auto mb-3" />
                  <p className="font-display text-lg text-cocoa mb-1">No notifications yet</p>
                  <p className="font-sans text-sm text-cocoa-muted">
                    We will notify you here the second your order status changes.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'bg-white border rounded-xl p-4 transition-all',
                      notif.is_read ? 'border-linen' : 'border-sage/30 bg-sage/5 shadow-2xs'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {!notif.is_read && (
                        <div className="w-2.5 h-2.5 bg-sage rounded-full shrink-0 mt-1.5 animate-pulse" />
                      )}
                      <div className={cn(notif.is_read ? 'ml-1' : '')}>
                        <p className="font-sans text-sm font-semibold text-cocoa">{notif.title}</p>
                        <p className="font-sans text-xs text-cocoa-muted mt-0.5 leading-relaxed">{notif.message}</p>
                        <p className="font-sans text-[10px] text-cocoa-muted mt-2">
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
              className="fixed inset-0 bg-cocoa z-45 pointer-events-auto"
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

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
