'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X, Plus, Minus, ShoppingBag, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCart } from './CartProvider'
import { formatPrice } from '@/lib/utils'

export default function CartDrawer() {
  const { items, isCartOpen, setIsCartOpen, updateQuantity, totalPaise, totalItems } =
    useCart()

  // Lock body scroll when cart is open
  useEffect(() => {
    if (isCartOpen) {
      document.body.classList.add('no-scroll')
    } else {
      document.body.classList.remove('no-scroll')
    }
    return () => document.body.classList.remove('no-scroll')
  }, [isCartOpen])

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCartOpen(false)}
            className="fixed inset-0 bg-cocoa/30 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full sm:max-w-sm bg-cream z-50 flex flex-col shadow-modal"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-linen">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-sage" />
                <h2 className="font-display text-xl text-cocoa">Your Order</h2>
                {totalItems > 0 && (
                  <span className="bg-sage text-cream text-xs font-bold px-2 py-0.5 rounded-full">
                    {totalItems}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 rounded-lg hover:bg-cream-200 transition-colors"
              >
                <X size={18} className="text-cocoa" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <ShoppingBag size={40} className="text-linen mb-4" />
                  <p className="font-display text-lg text-cocoa mb-1">Your cart is empty</p>
                  <p className="font-sans text-sm text-cocoa-muted mb-6">
                    Add items from our menu to get started
                  </p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="btn-primary text-sm"
                  >
                    Browse Menu
                  </button>
                </div>
              ) : (
                items.map((item) => (
                  <motion.div
                    key={item.size_id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex gap-3 items-center"
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-cream-200 relative">
                      <Image
                        src={item.image_path}
                        alt={item.name}
                        fill
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-sm font-medium text-cocoa truncate">
                        {item.name}
                      </p>
                      <p className="font-sans text-xs text-cocoa-muted">{item.size_label}</p>
                      <p className="price-tag text-sm mt-0.5">{formatPrice(item.price_paise)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => updateQuantity(item.size_id, item.quantity - 1)}
                        className="w-8 h-8 rounded-lg border border-linen flex items-center justify-center hover:bg-cream-200 active:scale-90 transition-all"
                        aria-label="Decrease quantity"
                      >
                        {item.quantity === 1 ? (
                          <Trash2 size={12} className="text-cocoa-muted" />
                        ) : (
                          <Minus size={12} className="text-cocoa" />
                        )}
                      </button>
                      <span className="font-sans text-sm font-medium text-cocoa w-5 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.size_id, item.quantity + 1)}
                        className="w-8 h-8 rounded-lg bg-sage text-cream flex items-center justify-center hover:bg-sage-dark active:scale-90 transition-all"
                        aria-label="Increase quantity"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-linen px-5 py-5 space-y-4 bg-cream">
                <div className="flex justify-between items-center">
                  <span className="font-sans text-sm text-cocoa-muted">Subtotal</span>
                  <span className="font-sans font-semibold text-cocoa text-base">
                    {formatPrice(totalPaise)}
                  </span>
                </div>
                <Link
                  href="/checkout"
                  onClick={() => setIsCartOpen(false)}
                  className="btn-primary w-full text-center block text-sm"
                >
                  Proceed to Checkout
                </Link>
                <p className="font-sans text-xs text-cocoa-muted text-center">
                  Secure payment via Razorpay
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
