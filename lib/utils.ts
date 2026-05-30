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

export function isExtraCheeseEligible(category: string): boolean {
  const eligibleCategories = [
    'Premium Loaded Pizza',
    'Cheesy Sides & Bread Pizza',
    'Grill & Thrill Sandwiches',
    'Single Topping Pizza',
    'Double Topping Pizza',
  ]
  return eligibleCategories.includes(category)
}

export function getExtraCheesePrice(category: string, sizeLabel: string): number {
  if (!isExtraCheeseEligible(category)) return 0

  const normalizedSize = sizeLabel.toLowerCase().trim()

  if (category === 'Premium Loaded Pizza') {
    if (normalizedSize === 'small' || normalizedSize === 'half') {
      return 3000
    }
    return 5000
  } else {
    if (normalizedSize === 'small' || normalizedSize === 'half' || normalizedSize === 'regular') {
      return 2000
    }
    return 3000
  }
}
