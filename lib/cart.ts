import type { CartItem } from '@/lib/types'

export const MAX_CART_ITEM_QUANTITY = 25

export function normalizeStoredCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((candidate): CartItem[] => {
    if (!candidate || typeof candidate !== 'object') return []
    const item = candidate as Partial<CartItem>
    if (
      typeof item.menu_item_id !== 'string' ||
      typeof item.size_id !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.size_label !== 'string' ||
      typeof item.image_path !== 'string' ||
      !Number.isSafeInteger(item.price_paise) ||
      Number(item.price_paise) < 0 ||
      !Number.isSafeInteger(item.quantity) ||
      Number(item.quantity) < 1
    ) return []

    const extraCheesePrice = item.extra_cheese_price_paise
    return [{
      menu_item_id: item.menu_item_id,
      size_id: item.size_id,
      name: item.name,
      size_label: item.size_label,
      image_path: item.image_path,
      price_paise: Number(item.price_paise),
      quantity: Math.min(Number(item.quantity), MAX_CART_ITEM_QUANTITY),
      extra_cheese: Boolean(item.extra_cheese),
      extra_cheese_price_paise: Number.isSafeInteger(extraCheesePrice) && Number(extraCheesePrice) >= 0
        ? Number(extraCheesePrice)
        : undefined,
      category: typeof item.category === 'string' ? item.category : undefined,
    }]
  })
}
