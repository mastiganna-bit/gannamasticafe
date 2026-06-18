'use client'

import { useState, useEffect } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { formatPrice, cn, getExtraCheesePrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Script from 'next/script'
import { ShieldCheck, Lock, ChevronDown, ShoppingBag, MapPin, Truck, Store, Compass, Utensils } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RazorpayOptions } from '@/lib/types'
import dynamic from 'next/dynamic'

const PinMapComponent = dynamic(() => import('@/components/cart/PinMapComponent'), { ssr: false })

export default function CheckoutPage() {
  const { items, totalPaise, clearCart } = useCart()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  
  // Checkout Delivery Options
  const [deliveryOption, setDeliveryOption] = useState<'pickup' | 'delivery' | 'dine_in'>('pickup')
  const [tableNumber, setTableNumber] = useState('')
  const [address, setAddress] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null)
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null)
  const [pinAdjusted, setPinAdjusted] = useState(false)
  const [showMap, setShowMap] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  const [cheesePrices, setCheesePrices] = useState<{ standard: number; premiumPizzaSmall: number; premiumPizzaOther: number; specialItem: number } | undefined>(undefined)

  // Fetch dynamic cheese prices
  useEffect(() => {
    const fetchCheesePrices = async () => {
      try {
        const { data } = await supabase
          .from('menu_items')
          .select('*, menu_item_sizes(*)')
          .eq('category', 'System')
          .eq('name', 'Extra Cheese Settings')
          .single()

        if (data && data.menu_item_sizes) {
          const sizes = data.menu_item_sizes as any[]
          const std = sizes.find(s => s.size_label === 'Standard Price')
          const premSmall = sizes.find(s => s.size_label === 'Premium Pizza (Small/Half) Price')
          const premOther = sizes.find(s => s.size_label === 'Premium Pizza (Medium/Large) Price')
          const spec = sizes.find(s => s.size_label === 'Special Item Price')

          setCheesePrices({
            standard: std ? std.price_paise : 2000,
            premiumPizzaSmall: premSmall ? premSmall.price_paise : 3000,
            premiumPizzaOther: premOther ? premOther.price_paise : 5000,
            specialItem: spec ? spec.price_paise : 3000
          })
        }
      } catch (err) {
        console.error('Failed to fetch dynamic cheese prices:', err)
      }
    }
    fetchCheesePrices()
  }, [supabase])


  // 1. Enforce authentication on checkout mount & autofill details
  useEffect(() => {
    const verifyUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Please sign in to place an order.', { id: 'auth-required' })
        router.push('/login?next=/checkout')
      } else {
        if (user.email) {
          setEmail(user.email)
        }

        // Fetch user metadata (Google ID)
        const meta = user.user_metadata || {}
        let metaName = meta.full_name || ''
        let metaPhone = meta.phone || ''
        let metaAddress = meta.address || ''

        // Fetch profiles table as fallback/backup
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', user.id)
            .single()

          if (profile) {
            if (!metaName && profile.full_name) metaName = profile.full_name
            if (!metaPhone && profile.phone) metaPhone = profile.phone
          }
        } catch (err) {
          console.error('Failed to fetch profile:', err)
        }

        // Fetch localStorage as final fallback
        const savedName = localStorage.getItem('gannamasti_customer_name')
        const savedPhone = localStorage.getItem('gannamasti_customer_phone')
        const savedAddress = localStorage.getItem('gannamasti_customer_address')

        if (metaName || savedName) setName(metaName || savedName || '')
        if (metaPhone || savedPhone) setPhone(metaPhone || savedPhone || '')
        if (metaAddress || savedAddress) setAddress(metaAddress || savedAddress || '')

        setCheckingAuth(false)
      }
    }
    verifyUser()
  }, [router, supabase])
  
  // 2. Persist and pre-fill delivery option preference from localStorage
  useEffect(() => {
    const savedOption = localStorage.getItem('gannamasti_delivery_option')
    if (savedOption === 'pickup' || savedOption === 'delivery' || savedOption === 'dine_in') {
      setDeliveryOption(savedOption as any)
    }
  }, [])

  // 2. Pricing & Charge calculations (paise)
  const subtotalPrice = totalPaise

  // Sugarcane quantity logic (Ganna / Sugarcane matching)
  const sugarcaneQty = items
    .filter(item => 
      item.name.toLowerCase().includes('sugarcane') ||
      item.name.toLowerCase().includes('ganna') ||
      (item.category && item.category.toLowerCase().includes('cane'))
    )
    .reduce((sum, item) => sum + item.quantity, 0)
  const packagingCharges = sugarcaneQty * 500 // ₹5 per sugarcane item in paise

  // Flat Platform Fee
  const platformFee = 600 // ₹6 flat in paise

  // Delivery Charges: ₹50 under ₹299 (paise threshold: 29900), free for ₹300+ (30000+)
  const deliveryCharges = deliveryOption === 'delivery'
    ? (subtotalPrice < 29900 ? 5000 : 0)
    : 0

  // 10% Discount on non-sugarcane items for self-pickup
  let discountAmount = 0
  if (deliveryOption === 'pickup') {
    items.forEach(item => {
      const isSugarcane = item.name.toLowerCase().includes('sugarcane') ||
                          item.name.toLowerCase().includes('ganna') ||
                          (item.category && item.category.toLowerCase().includes('cane'))
      if (!isSugarcane) {
        const extraPrice = item.extra_cheese ? getExtraCheesePrice(item.category || '', item.size_label, item.name, cheesePrices) : 0
        discountAmount += Math.round(0.10 * (item.price_paise + extraPrice) * item.quantity)
      }
    })
  }

  // Grand Total calculation
  const grandTotal = subtotalPrice + packagingCharges + platformFee + deliveryCharges - discountAmount

  // HTML5 geolocation puller
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setDeliveryLat(latitude)
        setDeliveryLng(longitude)
        setPinAdjusted(true)
        setShowMap(true)
        
        setAddress(prev => {
          const newCoord = `📍 GPS Delivery Link: https://maps.google.com/?q=${latitude},${longitude}\n`
          if (prev.includes('GPS Delivery Link')) {
            return prev.replace(/📍 GPS Delivery Link: https:\/\/maps\.google\.com\/\?q=[-\d.]+,[-\d.]+\n?/, newCoord)
          }
          return prev ? newCoord + prev : `${newCoord}House No / Landmark: `
        })
        setIsLocating(false)
        toast.success('GPS location captured! Adjust pin on the map below for high precision.', { icon: '📍' })
      },
      (error) => {
        console.error('Geolocation error:', error)
        setIsLocating(false)
        toast.error('Location block. Please enter your address manually.')
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()

    if (items.length === 0) {
      toast.error('Your cart is empty!')
      return
    }
    if (!name || !phone) {
      toast.error('Please enter your name and phone number')
      return
    }
    if (phone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number')
      return
    }
    if (deliveryOption === 'delivery' && !address) {
      toast.error('Please provide a delivery address!')
      return
    }

    setIsLoading(true)

    // Validate item availability before starting payment flow
    try {
      const { data: dbItems, error: stockErr } = await supabase
        .from('menu_items')
        .select('id, name, is_available')
        .in('id', items.map(item => item.menu_item_id))

      if (stockErr) throw stockErr

      const unavailableItems = items.filter(cartItem => {
        const matched = dbItems?.find(db => db.id === cartItem.menu_item_id)
        return !matched || !matched.is_available
      })

      if (unavailableItems.length > 0) {
        const names = unavailableItems.map(i => i.name).join(', ')
        toast.error(`Sorry, the following items are currently sold out or hidden: ${names}. Please remove/edit them to proceed.`, { duration: 6000 })
        setIsLoading(false)
        return
      }
    } catch (err) {
      console.error('Stock verification error:', err)
      toast.error('Failed to verify items availability. Please try again.')
      setIsLoading(false)
      return
    }

    // Save details to localStorage for next time
    localStorage.setItem('gannamasti_customer_name', name)
    localStorage.setItem('gannamasti_customer_phone', phone)
    localStorage.setItem('gannamasti_customer_address', address)
    localStorage.setItem('gannamasti_delivery_option', deliveryOption)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Update Google ID user metadata (autofills next time)
        await supabase.auth.updateUser({
          data: {
            full_name: name,
            phone: phone,
            address: address,
          }
        })

        // Update public profiles table
        await supabase
          .from('profiles')
          .update({
            full_name: name,
            phone: phone,
          })
          .eq('id', user.id)
      }

      // Format clean kitchen order note
      const formattedNotes = `${notes}\n[OPTION: ${
        deliveryOption === 'delivery' ? 'Home Delivery' : deliveryOption === 'dine_in' ? 'Dine-In' : 'Self-Pickup'
      }]${
        deliveryOption === 'delivery' ? `\n[DELIVERY ADDRESS: ${address}]` : ''
      }${
        deliveryOption === 'dine_in' && tableNumber ? `\n[TABLE NUMBER: ${tableNumber}]` : ''
      }`

      // Step 1: Create Razorpay order on server
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: grandTotal,
          customer_name: name,
          customer_phone: phone,
          customer_email: email,
          items,
          notes: formattedNotes,
          user_id: user?.id || null,
          delivery_type: deliveryOption === 'pickup' ? 'takeaway' : deliveryOption,
          delivery_address: deliveryOption === 'delivery' ? address : null,
          delivery_notes: notes || null,
          delivery_lat: deliveryOption === 'delivery' ? deliveryLat : null,
          delivery_lng: deliveryOption === 'delivery' ? deliveryLng : null,
          pin_adjusted: deliveryOption === 'delivery' ? pinAdjusted : false,
        }),
      })

      const orderData = await response.json()

      if (!response.ok || !orderData.razorpay_order_id) {
        throw new Error(orderData.error || 'Failed to create order')
      }

      // Step 2: Open Razorpay checkout
      const razorpayOptions: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount: grandTotal,
        currency: 'INR',
        name: 'Gannamasti Cafe',
        description: `${deliveryOption === 'delivery' ? 'Home Delivery' : deliveryOption === 'dine_in' ? 'Dine-In' : 'Self-Pickup'} Order`,
        image: '/images/logo.png',
        order_id: orderData.razorpay_order_id,
        handler: async (response) => {
          // Step 3: Verify payment on server
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          })

          const verifyData = await verifyRes.json()

          if (verifyData.success) {
            clearCart()
            toast.success('Order placed successfully!')
            router.push(`/order-success?order_id=${orderData.order_db_id}`)
          } else {
            toast.error('Payment verification failed. Please contact us.')
          }
        },
        prefill: {
          name,
          email,
          contact: phone,
        },
        theme: {
          color: '#3D6B4F',
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false)
            toast('Payment cancelled', { icon: '⚠️' })
          },
        },
      }

      const rzp = new (window as any).Razorpay(razorpayOptions)
      rzp.open()
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false)

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-cream pt-24 flex items-center justify-center">
        <div className="text-center px-4 flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sage/30 border-t-sage rounded-full animate-spin" />
          <p className="font-sans text-sm text-cocoa-muted">Verifying your secure session...</p>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-cream pt-24 flex items-center justify-center">
        <div className="text-center px-4">
          <p className="font-display text-2xl text-cocoa mb-2">Your cart is empty</p>
          <p className="font-sans text-sm text-cocoa-muted mb-6">Add some items before checkout</p>
          <a href="/menu" className="btn-primary inline-block">Browse Menu</a>
        </div>
      </div>
    )
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <div className="min-h-screen bg-cream pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-10">
          <div className="mb-6 md:mb-8">
            <p className="font-sans text-xs text-sage font-medium uppercase tracking-widest mb-1">
              Almost there
            </p>
            <h1 className="font-serif text-3xl md:text-4xl text-cocoa font-light">Checkout</h1>
          </div>

          {/* Shopify-style Mobile Collapsible Order Summary */}
          <div className="block lg:hidden mb-6 bg-cream-200 border border-linen rounded-xl2 overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left font-sans text-xs xs:text-sm font-medium text-cocoa hover:bg-cream-300/40 transition-colors"
            >
              <span className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-sage" />
                {isSummaryExpanded ? 'Hide Order Summary' : 'Show Order Summary'}
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-cocoa">
                {formatPrice(grandTotal)}
                <ChevronDown size={14} className={cn('transition-transform duration-300', isSummaryExpanded && 'rotate-180')} />
              </span>
            </button>
            
            <AnimatePresence>
              {isSummaryExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 pb-4 pt-1 border-t border-linen bg-cream-100"
                >
                  <div className="space-y-3 mt-2">
                    {items.map((item) => {
                      const extraPrice = item.extra_cheese ? getExtraCheesePrice(item.category || '', item.size_label, item.name, cheesePrices) : 0
                      const itemTotalPrice = (item.price_paise + extraPrice) * item.quantity
                      return (
                        <div key={`${item.size_id}-${item.extra_cheese ? 'cheese' : 'regular'}`} className="flex items-start gap-3 py-1">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-cream shrink-0 relative border border-linen">
                            <Image
                              src={item.image_path}
                              alt={item.name}
                              fill
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-sans text-xs font-semibold text-cocoa truncate">{item.name}</p>
                            <div className="font-sans text-[10px] text-cocoa-muted flex flex-col leading-tight">
                              <span>Size: {item.size_label} · Qty: {item.quantity}</span>
                              {item.extra_cheese && (
                                <span className="text-[9px] text-sage font-semibold mt-0.5">
                                  + Extra Cheese (+{formatPrice(extraPrice)})
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="font-sans text-xs font-semibold text-amber-cafe shrink-0">
                            {formatPrice(itemTotalPrice)}
                          </p>
                        </div>
                      )
                    })}

                    {/* Breakdown inside mobile summary */}
                    <div className="border-t border-linen pt-3 space-y-1.5 text-xs font-sans text-cocoa-muted">
                      <div className="flex justify-between">
                        <span>Items Subtotal</span>
                        <span className="text-cocoa font-medium">{formatPrice(subtotalPrice)}</span>
                      </div>
                      {packagingCharges > 0 && (
                        <div className="flex justify-between">
                          <span>Sugarcane Packaging Fee (₹5/item)</span>
                          <span className="text-cocoa font-medium">{formatPrice(packagingCharges)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Platform Fee</span>
                        <span className="text-cocoa font-medium">{formatPrice(platformFee)}</span>
                      </div>
                      {deliveryOption === 'delivery' && (
                        <div className="flex justify-between">
                          <span>Delivery Fee {subtotalPrice >= 29900 && '(Free over ₹300)'}</span>
                          <span className="text-cocoa font-medium">{deliveryCharges > 0 ? formatPrice(deliveryCharges) : 'FREE'}</span>
                        </div>
                      )}
                      {deliveryOption === 'pickup' && discountAmount > 0 && (
                        <div className="flex justify-between text-sage font-medium">
                          <span>10% Self-Pickup Discount</span>
                          <span>-{formatPrice(discountAmount)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
            {/* Form */}
            <div className="lg:col-span-3">
              <form onSubmit={handleCheckout} className="space-y-5">
                
                {/* 1. Pick Up vs Delivery vs Dine In Option Selector */}
                <div className="bg-cream-200 rounded-xl2 p-5 border border-linen">
                  <h2 className="font-display text-lg text-cocoa mb-3.5">How would you like your order?</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setDeliveryOption('pickup')}
                      className={cn(
                        'flex flex-col items-center justify-center p-4 rounded-xl border font-sans transition-all duration-300 cursor-pointer shadow-sm',
                        deliveryOption === 'pickup'
                          ? 'border-sage bg-sage/5 text-sage ring-1 ring-sage'
                          : 'border-linen bg-white text-cocoa-muted hover:text-cocoa hover:bg-cream-100/50'
                      )}
                    >
                      <Store size={22} className="mb-1.5" />
                      <span className="text-xs font-bold">Self-Pickup</span>
                      <span className="text-[9px] text-sage font-medium mt-1 uppercase tracking-wider bg-sage/10 px-2 py-0.5 rounded-full">10% OFF</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setDeliveryOption('delivery')}
                      className={cn(
                        'flex flex-col items-center justify-center p-4 rounded-xl border font-sans transition-all duration-300 cursor-pointer shadow-sm',
                        deliveryOption === 'delivery'
                          ? 'border-sage bg-sage/5 text-sage ring-1 ring-sage'
                          : 'border-linen bg-white text-cocoa-muted hover:text-cocoa hover:bg-cream-100/50'
                      )}
                    >
                      <Truck size={22} className="mb-1.5" />
                      <span className="text-xs font-bold">Home Delivery</span>
                      <span className="text-[9px] text-cocoa-muted font-medium mt-1">{subtotalPrice >= 29900 ? 'FREE DELIVERY' : '₹50 CHARGE'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryOption('dine_in')}
                      className={cn(
                        'flex flex-col items-center justify-center p-4 rounded-xl border font-sans transition-all duration-300 cursor-pointer shadow-sm',
                        deliveryOption === 'dine_in'
                          ? 'border-sage bg-sage/5 text-sage ring-1 ring-sage'
                          : 'border-linen bg-white text-cocoa-muted hover:text-cocoa hover:bg-cream-100/50'
                      )}
                    >
                      <Utensils size={22} className="mb-1.5" />
                      <span className="text-xs font-bold">Dine-In</span>
                      <span className="text-[9px] text-cocoa-muted font-medium mt-1">EAT AT CAFE</span>
                    </button>
                  </div>
                </div>

                {/* 2. Customer Details */}
                <div className="bg-cream-200 rounded-xl2 p-5 border border-linen">
                  <h2 className="font-display text-lg text-cocoa mb-4">Your Details</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="font-sans text-xs font-medium text-cocoa-muted mb-1.5 block">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                        className="input-field"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-sans text-xs font-medium text-cocoa-muted mb-1.5 block">
                        Phone Number *
                      </label>
                      <div className="flex gap-2">
                        <span className="input-field w-14 text-center shrink-0 bg-cream-200 border-r border-linen cursor-default flex items-center justify-center font-semibold text-cocoa">+91</span>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="10-digit number"
                          className="input-field flex-1"
                          required
                          maxLength={10}
                        />
                      </div>
                    </div>
                    
                    {deliveryOption === 'dine_in' && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="pt-2"
                      >
                        <label className="font-sans text-xs font-medium text-cocoa-muted mb-1.5 block">
                          Table Number (optional)
                        </label>
                        <input
                          type="text"
                          value={tableNumber}
                          onChange={(e) => setTableNumber(e.target.value)}
                          placeholder="e.g. Table 4 or Table 9"
                          className="input-field"
                        />
                      </motion.div>
                    )}
                    
                    {/* Delivery Address Field with Geolocator button */}
                    {deliveryOption === 'delivery' && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 pt-2"
                      >
                        <div className="flex items-center justify-between">
                          <label className="font-sans text-xs font-medium text-cocoa-muted block">
                            Delivery Address *
                          </label>
                          <button
                            type="button"
                            onClick={handleGetLocation}
                            disabled={isLocating}
                            className="flex items-center gap-1 text-[11px] font-sans font-semibold text-sage hover:text-sage-dark bg-white border border-linen p-1 px-2.5 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <Compass size={12} className={cn(isLocating && 'animate-spin')} />
                            <span>{isLocating ? 'Pinning...' : '📍 Use GPS Location'}</span>
                          </button>
                        </div>
                        <textarea
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Flat No, Apartment, Street name, and prominent Landmark * (GPS link will auto-append here if clicked)"
                          className="input-field resize-none h-24"
                          required
                        />

                        {showMap && deliveryLat && deliveryLng && (
                          <div className="space-y-1.5 mt-2">
                            <label className="font-sans text-[10px] font-bold text-sage uppercase tracking-wider block">
                              📍 Adjust Drop-off Spot
                            </label>
                            <PinMapComponent
                              latitude={deliveryLat}
                              longitude={deliveryLng}
                              onChange={(lat, lng) => {
                                setDeliveryLat(lat)
                                setDeliveryLng(lng)
                                setPinAdjusted(true)
                                setAddress(prev => {
                                  const newLink = `📍 GPS Delivery Link: https://maps.google.com/?q=${lat},${lng}\n`
                                  if (prev.includes('GPS Delivery Link')) {
                                    return prev.replace(/📍 GPS Delivery Link: https:\/\/maps\.google\.com\/\?q=[-\d.]+,[-\d.]+\n?/, newLink)
                                  }
                                  return newLink + prev
                                })
                              }}
                            />
                            <p className="font-sans text-[9px] text-cocoa-muted italic">
                              Drag the red pin to mark your exact gate or doorstep. Your driver will see this pin on their live GPS map!
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    <div>
                      <label className="font-sans text-xs font-medium text-cocoa-muted mb-1.5 block">
                        Special Instructions (optional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any special requests or instructions?"
                        className="input-field resize-none h-16"
                        maxLength={200}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full py-3.5 text-sm xs:text-base flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    <>
                      <Lock size={16} />
                      Pay {formatPrice(grandTotal)} Securely
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-2 text-cocoa-muted text-center">
                  <ShieldCheck size={14} className="text-sage shrink-0" />
                  <p className="font-sans text-[10px] xs:text-xs">Secured by Razorpay · UPI, Cards, NetBanking accepted</p>
                </div>
              </form>
            </div>

            {/* Order Summary - Desktop Only */}
            <div className="hidden lg:block lg:col-span-2">
              <div className="bg-cream-200 rounded-xl2 border border-linen p-5 sticky top-24 shadow-sm">
                <h2 className="font-display text-lg text-cocoa mb-4">Order Summary</h2>
                <div className="space-y-3.5 mb-5 max-h-[260px] overflow-y-auto pr-1 border-b border-linen/60 pb-4">
                  {items.map((item) => {
                    const extraPrice = item.extra_cheese ? getExtraCheesePrice(item.category || '', item.size_label, item.name, cheesePrices) : 0
                    const itemTotalPrice = (item.price_paise + extraPrice) * item.quantity
                    return (
                      <div key={`${item.size_id}-${item.extra_cheese ? 'cheese' : 'regular'}`} className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-cream shrink-0 relative border border-linen">
                          <Image
                            src={item.image_path}
                            alt={item.name}
                            fill
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-sans text-xs font-semibold text-cocoa truncate">{item.name}</p>
                          <div className="font-sans text-[10px] text-cocoa-muted flex flex-col leading-tight">
                            <span>Size: {item.size_label} · Qty: {item.quantity}</span>
                            {item.extra_cheese && (
                              <span className="text-[9px] text-sage font-semibold mt-0.5">
                                + Extra Cheese (+{formatPrice(extraPrice)})
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="font-sans text-xs font-semibold text-amber-cafe shrink-0">
                          {formatPrice(itemTotalPrice)}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* Subtotal breakdowns */}
                <div className="space-y-2 border-b border-linen/60 pb-3.5 mb-4 text-xs font-sans text-cocoa-muted">
                  <div className="flex justify-between items-center">
                    <span>Items Subtotal</span>
                    <span className="text-cocoa font-medium">{formatPrice(subtotalPrice)}</span>
                  </div>
                  {packagingCharges > 0 && (
                    <div className="flex justify-between items-center">
                      <span>Sugarcane Packaging Fee (₹5/item)</span>
                      <span className="text-cocoa font-medium">{formatPrice(packagingCharges)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span>Platform Fee</span>
                    <span className="text-cocoa font-medium">{formatPrice(platformFee)}</span>
                  </div>
                  {deliveryOption === 'delivery' && (
                    <div className="flex justify-between items-center">
                      <span>Delivery Fee {subtotalPrice >= 29900 && '(Free over ₹300)'}</span>
                      <span className="text-cocoa font-medium">
                        {deliveryCharges > 0 ? formatPrice(deliveryCharges) : 'FREE'}
                      </span>
                    </div>
                  )}
                  {deliveryOption === 'pickup' && discountAmount > 0 && (
                    <div className="flex justify-between items-center text-sage font-semibold">
                      <span>10% Self-Pickup Discount</span>
                      <span>-{formatPrice(discountAmount)}</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center">
                    <span className="font-sans text-sm text-cocoa-muted font-bold">Grand Total</span>
                    <span className="font-sans font-bold text-cocoa text-xl">{formatPrice(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
