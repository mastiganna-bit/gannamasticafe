'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { CartItem } from '@/lib/types'
import toast from 'react-hot-toast'
import CartDrawer from './CartDrawer'

type CartContextType = {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (sizeId: string) => void
  updateQuantity: (sizeId: string, quantity: number) => void
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
  }, [])

  // Save cart to localStorage on change
  const saveCart = (newItems: CartItem[]) => {
    setItems(newItems)
    localStorage.setItem('gannamasti_cart', JSON.stringify(newItems))
  }

  const addItem = useCallback((newItem: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.size_id === newItem.size_id)
      let updated: CartItem[]
      if (existing) {
        toast.success(`${newItem.name} quantity updated`)
        updated = prev.map((i) =>
          i.size_id === newItem.size_id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      } else {
        toast.success(`${newItem.name} added to order`)
        updated = [...prev, newItem]
      }
      localStorage.setItem('gannamasti_cart', JSON.stringify(updated))
      return updated
    })
    setIsCartOpen(true)
  }, [])

  const removeItem = useCallback((sizeId: string) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.size_id !== sizeId)
      localStorage.setItem('gannamasti_cart', JSON.stringify(updated))
      return updated
    })
  }, [])

  const updateQuantity = useCallback((sizeId: string, quantity: number) => {
    setItems((prev) => {
      let updated: CartItem[]
      if (quantity <= 0) {
        updated = prev.filter((i) => i.size_id !== sizeId)
      } else {
        updated = prev.map((i) => (i.size_id === sizeId ? { ...i, quantity } : i))
      }
      localStorage.setItem('gannamasti_cart', JSON.stringify(updated))
      return updated
    })
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    localStorage.removeItem('gannamasti_cart')
  }, [])

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const totalPaise = items.reduce((sum, i) => sum + i.price_paise * i.quantity, 0)

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
