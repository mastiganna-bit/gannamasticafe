'use client'

import { useState } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { formatPrice, cn, getExtraCheesePrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Script from 'next/script'
import { ShieldCheck, Lock, ChevronDown, ShoppingBag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RazorpayOptions } from '@/lib/types'

export default function CheckoutPage() {
  const { items, totalPaise, clearCart } = useCart()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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
      toast.error('Please enter a valid phone number')
      return
    }

    setIsLoading(true)

    try {
      // Get current user (optional - allow guest checkout)
      const { data: { user } } = await supabase.auth.getUser()

      // Step 1: Create Razorpay order on server
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalPaise,
          customer_name: name,
          customer_phone: phone,
          customer_email: email,
          items,
          notes,
          user_id: user?.id || null,
        }),
      })

      const orderData = await response.json()

      if (!response.ok || !orderData.razorpay_order_id) {
        throw new Error(orderData.error || 'Failed to create order')
      }

      // Step 2: Open Razorpay checkout
      const razorpayOptions: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount: totalPaise,
        currency: 'INR',
        name: 'Gannamasti Cafe',
        description: `Order of ${items.length} item(s)`,
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

      const rzp = new window.Razorpay(razorpayOptions)
      rzp.open()
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false)

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
                {formatPrice(totalPaise)}
                <ChevronDown size={14} className={cn('transition-transform duration-300', isSummaryExpanded && 'rotate-180')} />
              </span>
            </button>
            
            <AnimatePresence>
              {isSummaryExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 pb-4 pt-1 border-t border-linen space-y-3 bg-cream-100"
                >
                  <div className="space-y-3 mt-2">
                    {items.map((item) => {
                      const extraPrice = item.extra_cheese ? getExtraCheesePrice(item.category || '', item.size_label) : 0
                      const itemTotalPrice = (item.price_paise + extraPrice) * item.quantity
                      return (
                        <div key={`${item.size_id}-${item.extra_cheese ? 'cheese' : 'regular'}`} className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-cream shrink-0 relative border border-linen">
                            <Image
                              src={item.image_path}
                              alt={item.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-sans text-xs font-medium text-cocoa truncate">{item.name}</p>
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
            {/* Form */}
            <div className="lg:col-span-3">
              <form onSubmit={handleCheckout} className="space-y-5">
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
                    <div>
                      <label className="font-sans text-xs font-medium text-cocoa-muted mb-1.5 block">
                        Email (optional)
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="For order receipt"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="font-sans text-xs font-medium text-cocoa-muted mb-1.5 block">
                        Special Instructions (optional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any special requests?"
                        className="input-field resize-none h-20"
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
                      Pay {formatPrice(totalPaise)} Securely
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
                <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-1">
                  {items.map((item) => {
                    const extraPrice = item.extra_cheese ? getExtraCheesePrice(item.category || '', item.size_label) : 0
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
                <div className="border-t border-linen pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-sans text-sm text-cocoa-muted font-medium">Total</span>
                    <span className="font-sans font-bold text-cocoa text-lg">{formatPrice(totalPaise)}</span>
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
