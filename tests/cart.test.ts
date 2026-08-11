import { describe, expect, it } from 'vitest'
import { normalizeStoredCart } from '@/lib/cart'

const validItem = {
  menu_item_id: 'item-1', size_id: 'size-1', name: 'Test item', size_label: 'Regular',
  image_path: '/test.jpg', price_paise: 5000, quantity: 1,
}

describe('stored cart normalization', () => {
  it('drops malformed rows and caps quantities at the checkout limit', () => {
    const result = normalizeStoredCart([validItem, null, { ...validItem, size_id: 'size-2', quantity: 999 }])
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject(validItem)
    expect(result[1]).toMatchObject({ ...validItem, size_id: 'size-2', quantity: 25 })
  })

  it('returns an empty cart for non-array browser data', () => {
    expect(normalizeStoredCart({ corrupted: true })).toEqual([])
  })
})
