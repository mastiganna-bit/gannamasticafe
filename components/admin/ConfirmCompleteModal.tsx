'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle } from 'lucide-react'

export default function ConfirmCompleteModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  orderId,
  customerName,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
  orderId: string
  customerName: string
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-cocoa/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white border border-linen rounded-2xl w-full max-w-sm p-6 shadow-modal pointer-events-auto relative"
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-cream-200 text-cocoa transition-colors"
                disabled={isLoading}
              >
                <X size={16} />
              </button>

              {/* Icon & Title */}
              <div className="flex flex-col items-center text-center mt-2 mb-5">
                <div className="w-12 h-12 bg-sage/10 rounded-full flex items-center justify-center mb-4 text-sage">
                  <CheckCircle size={24} />
                </div>
                <h3 className="font-display text-xl text-cocoa">Complete Order</h3>
                <p className="font-sans text-xs text-cocoa-muted mt-1 leading-relaxed max-w-[240px]">
                  Mark order of <strong>{customerName}</strong> as ready?
                  They will be notified immediately.
                </p>
                <p className="font-mono text-[10px] text-cocoa-muted mt-2 bg-cream-200 px-2 py-0.5 rounded border border-linen">
                  #{orderId.slice(0, 8).toUpperCase()}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="btn-outline w-full py-2.5 text-xs border-linen text-cocoa hover:bg-cream-200"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className="btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5"
                >
                  {isLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                      Completing...
                    </>
                  ) : (
                    'Confirm'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
