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
