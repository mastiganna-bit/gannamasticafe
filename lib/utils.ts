import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`
}

export function formatPriceNumber(paise: number): number {
  return paise / 100
}

export function generateReceiptId(): string {
  return `GNMST_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`
}

import React from 'react'

export function isExtraCheeseEligible(category: string): boolean {
  const eligibleCategories = [
    'Premium Loaded Pizza',
    'Cheesy Sides & Bread Pizza',
    'Grill & Thrill Sandwiches',
    'Single Topping Pizza',
    'Double Topping Pizza',
    'Burger Binge',
  ]
  return eligibleCategories.includes(category)
}

export function getExtraCheesePrice(
  category: string,
  sizeLabel: string,
  itemName?: string,
  dynamicPrices?: { standard: number; premiumPizzaSmall: number; premiumPizzaOther: number; specialItem: number }
): number {
  const prices = dynamicPrices || {
    standard: 2000,
    premiumPizzaSmall: 3000,
    premiumPizzaOther: 5000,
    specialItem: 3000
  }

  if (itemName) {
    const name = itemName.toLowerCase().trim()
    if (
      name.includes('mix veggie paneer') ||
      name.includes('gannamasti spl') ||
      name.includes('gannamasti special')
    ) {
      return prices.specialItem
    }
  }

  if (!isExtraCheeseEligible(category)) return 0

  const normalizedSize = sizeLabel.toLowerCase().trim()

  if (category === 'Premium Loaded Pizza') {
    if (normalizedSize === 'small' || normalizedSize === 'half') {
      return prices.premiumPizzaSmall
    }
    return prices.premiumPizzaOther
  } else {
    if (normalizedSize === 'small' || normalizedSize === 'half' || normalizedSize === 'regular') {
      return prices.standard
    }
    return prices.premiumPizzaSmall
  }
}

// Parse address text and identify Google Maps links or other URLs
export function parseAddressText(text: string | null | undefined): { content: string; isUrl: boolean }[] {
  if (!text) return []
  
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  
  return parts.map((part) => ({
    content: part,
    isUrl: !!part.match(urlRegex)
  }))
}

