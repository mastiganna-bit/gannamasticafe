import { beforeAll, describe, expect, it } from 'vitest'
import { decryptHandoverCode, encryptHandoverCode, generateHandoverCode, hashHandoverCode } from '@/lib/server/handover'

beforeAll(()=>{process.env.DELIVERY_HANDOVER_SECRET='test-only-secret-with-enough-entropy'})
describe('delivery handover security',()=>{
  it('generates exactly six digits',()=>expect(generateHandoverCode()).toMatch(/^\d{6}$/))
  it('encrypts reversibly without exposing plaintext',()=>{const encrypted=encryptHandoverCode('668731');expect(encrypted).not.toContain('668731');expect(decryptHandoverCode(encrypted)).toBe('668731')})
  it('hashes codes deterministically',()=>{expect(hashHandoverCode('123456')).toBe(hashHandoverCode('123456'));expect(hashHandoverCode('123456')).not.toBe(hashHandoverCode('123457'))})
})
