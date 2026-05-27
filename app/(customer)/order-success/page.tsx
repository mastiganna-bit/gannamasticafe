'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { CheckCircle, Clock, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Order } from '@/lib/types'
import { formatPrice } from '@/lib/utils'

function OrderSuccessContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order_id')
  const [order, setOrder] = useState<Order | null>(null)

  useEffect(() => {
    if (!orderId) return
    const supabase = createClient()

    // Fetch order
    supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
      .then(({ data }) => {
        if (data) setOrder(data as Order)
      })
  }, [orderId])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="bg-white border border-linen rounded-2xl p-8 md:p-12 max-w-md w-full text-center shadow-card"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="w-16 h-16 bg-sage/10 rounded-full flex items-center justify-center mx-auto mb-6"
      >
        <CheckCircle size={32} className="text-sage" />
      </motion.div>

      <h1 className="font-serif text-3xl text-cocoa font-light mb-2">
        Order Placed!
      </h1>
      <p className="font-sans text-sm text-cocoa-muted mb-6">
        Your order is confirmed and being prepared.
      </p>

      {order && (
        <div className="bg-cream-200 rounded-xl p-4 mb-6 text-left space-y-2">
          <div className="flex justify-between text-xs font-sans">
            <span className="text-cocoa-muted">Order Total</span>
            <span className="font-semibold text-amber-cafe">{formatPrice(order.total_paise)}</span>
          </div>
          <div className="flex justify-between text-xs font-sans">
            <span className="text-cocoa-muted">Name</span>
            <span className="text-cocoa font-medium">{order.customer_name}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-sans">
            <span className="text-cocoa-muted">Status</span>
            <span className="flex items-center gap-1 text-sage font-medium">
              <Clock size={11} /> Preparing
            </span>
          </div>
        </div>
      )}

      <p className="font-sans text-xs text-cocoa-muted mb-6">
        We'll notify you when your order is ready. 🎉
      </p>

      <div className="flex flex-col gap-3">
        <Link href="/account" className="btn-primary flex items-center justify-center gap-2 text-sm">
          Track My Order <ArrowRight size={14} />
        </Link>
        <Link href="/menu" className="btn-outline text-sm">
          Order More
        </Link>
      </div>
    </motion.div>
  )
}

export default function OrderSuccessPage() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center pt-16 px-4">
      <Suspense fallback={
        <div className="text-center font-sans text-cocoa-muted">
          <div className="w-12 h-12 border-4 border-sage/20 border-t-sage rounded-full animate-spin mx-auto mb-4" />
          Loading order details...
        </div>
      }>
        <OrderSuccessContent />
      </Suspense>
    </div>
  )
}
