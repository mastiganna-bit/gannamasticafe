import { describe, expect, it } from 'vitest'
import { addressSchema, indianPhoneSchema, passwordSchema } from '@/lib/server/validation'

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
})
