'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { CartItem } from '@/lib/types'
import { getExtraCheesePrice } from '@/lib/utils'
import toast from 'react-hot-toast'
import CartDrawer from './CartDrawer'

type CartContextType = {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (sizeId: string, extraCheese?: boolean) => void
  updateQuantity: (sizeId: string, quantity: number, extraCheese?: boolean) => void
  clearCart: () => void
  totalItems: number
  totalPaise: number
  isCartOpen: boolean
  setIsCartOpen: (open: boolean) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)

  const [isMounted, setIsMounted] = useState(false)

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('gannamasti_cart')
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart))
      } catch (e) {
        console.error('Failed to load cart', e)
      }
    }
    setIsMounted(true)
  }, [])

  // Sync state to localStorage whenever items changes
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('gannamasti_cart', JSON.stringify(items))
    }
  }, [items, isMounted])

  const addItem = useCallback((newItem: CartItem) => {
    // Check current items state directly to trigger toast exactly once
    const existing = items.find((i) => i.size_id === newItem.size_id && !!i.extra_cheese === !!newItem.extra_cheese)
    if (existing) {
      toast.success(`${newItem.name}${newItem.extra_cheese ? ' (Extra Cheese)' : ''} quantity updated`)
    } else {
      toast.success(`${newItem.name}${newItem.extra_cheese ? ' (with Extra Cheese)' : ''} added to order`)
    }

    setItems((prev) => {
      const exists = prev.find((i) => i.size_id === newItem.size_id && !!i.extra_cheese === !!newItem.extra_cheese)
      if (exists) {
        return prev.map((i) =>
          i.size_id === newItem.size_id && !!i.extra_cheese === !!newItem.extra_cheese
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [...prev, newItem]
    })
  }, [items])

  const removeItem = useCallback((sizeId: string, extraCheese?: boolean) => {
    setItems((prev) => prev.filter((i) => !(i.size_id === sizeId && !!i.extra_cheese === !!extraCheese)))
  }, [])

  const updateQuantity = useCallback((sizeId: string, quantity: number, extraCheese?: boolean) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((i) => !(i.size_id === sizeId && !!i.extra_cheese === !!extraCheese))
      }
      return prev.map((i) => (i.size_id === sizeId && !!i.extra_cheese === !!extraCheese ? { ...i, quantity } : i))
    })
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const totalPaise = items.reduce((sum, i) => {
    const extraPrice = i.extra_cheese ? getExtraCheesePrice(i.category || '', i.size_label) : 0
    return sum + (i.price_paise + extraPrice) * i.quantity
  }, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPaise,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
      <CartDrawer />
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
