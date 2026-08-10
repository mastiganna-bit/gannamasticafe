import { describe, expect, it } from 'vitest'
import { addressSchema, indianPhoneSchema, passwordSchema } from '@/lib/server/validation'
import { quoteItemSchema } from '@/lib/server/quote'

describe('customer input validation', () => {
  it('normalizes valid Indian mobile numbers', () => {
    expect(indianPhoneSchema.parse('98126 82980')).toBe('+919812682980')
    expect(indianPhoneSchema.parse('+91-98126-82980')).toBe('+919812682980')
  })

  it('rejects invalid phone numbers and weak passwords', () => {
    expect(indianPhoneSchema.safeParse('12345').success).toBe(false)
    expect(passwordSchema.safeParse('password').success).toBe(false)
    expect(passwordSchema.safeParse('Secure123').success).toBe(true)
  })

  it('requires a structured address and valid coordinates', () => {
    const result = addressSchema.safeParse({ label:'Home',recipientName:'Amit',phone:'+919812682980',house:'12',area:'Model Town',city:'Rohtak',latitude:28.89,longitude:76.58 })
    expect(result.success).toBe(true)
    expect(addressSchema.safeParse({ label:'Home',recipientName:'Amit',phone:'+919812682980',house:'12',area:'Model Town',city:'Rohtak',latitude:128,longitude:76.58 }).success).toBe(false)
  })

  it('accepts legacy PostgreSQL UUID menu keys without weakening their shape', () => {
    const item = {
      menu_item_id: '11111111-1111-1111-1111-111111111001',
      size_id: '22222222-2222-2222-2222-222222222001',
      quantity: 1,
    }
    expect(quoteItemSchema.safeParse(item).success).toBe(true)
    expect(quoteItemSchema.safeParse({ ...item, size_id: 'not-an-id' }).success).toBe(false)
  })
})
