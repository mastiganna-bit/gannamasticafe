'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Minus, Plus, ShoppingBag } from 'lucide-react'
import { MenuItem, MenuItemSize } from '@/lib/types'
import { formatPrice } from '@/lib/utils'
import { useCart } from '@/components/cart/CartProvider'

export default function ItemDetailClient({ item }: { item: MenuItem }) {
  const { addItem } = useCart()
  const initial = item.menu_item_sizes.find((size) => size.id === item.default_size_id)
    || item.menu_item_sizes.find((size) => item.category === 'The Cane Bar' && size.size_label.toLowerCase() === 'medium')
    || item.menu_item_sizes.find((size) => item.category === 'Grill & Thrill Sandwiches' && size.size_label.toLowerCase() === 'full')
    || item.menu_item_sizes[0]
  const [size, setSize] = useState<MenuItemSize>(initial)
  const [quantity, setQuantity] = useState(1)
  const [extraCheese, setExtraCheese] = useState(false)
  const cheesePrice = Number(size.extra_cheese_price_paise ?? item.extra_cheese_price_paise ?? 0)
  const sizeName = size.size_label.toLowerCase().trim()
  const displayImagePath = item.category === 'The Cane Bar'
    ? sizeName === 'regular' ? '/images/cane/ganna-regular.jpg'
      : sizeName === 'medium' ? '/images/cane/ganna-medium.jpg'
        : sizeName === 'large' ? '/images/cane/ganna-large.jpg'
          : sizeName === 'extra large' || sizeName === 'xl' ? '/images/cane/ganna-xl.jpg'
            : sizeName === 'jumbo' ? '/images/cane/ganna-jumbo.jpg'
              : item.image_path
    : item.image_path

  const add = () => {
    addItem({
      menu_item_id: item.id, size_id: size.id, name: item.name, size_label: size.size_label,
      price_paise: size.price_paise, quantity, image_path: displayImagePath, category: item.category,
      extra_cheese: extraCheese, extra_cheese_price_paise: extraCheese ? cheesePrice : 0,
    })
  }

  return <main className="min-h-screen bg-cream px-4 pb-16 pt-24">
    <div className="mx-auto max-w-5xl">
      <Link href="/menu" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-sage"><ArrowLeft size={16} /> Back to menu</Link>
      <div className="grid overflow-hidden rounded-3xl border border-linen bg-white shadow-card md:grid-cols-2">
        <div className="relative min-h-80 bg-cream-200"><img src={displayImagePath} alt={`${item.name} ${size.size_label}`} className="absolute inset-0 h-full w-full object-cover" /></div>
        <div className="p-6 sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-widest text-sage">{item.category}</p>
          <h1 className="mt-2 font-display text-4xl text-cocoa">{item.name}</h1>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-cocoa-muted">{item.description || 'Freshly prepared to order at Gannamasti Cafe.'}</p>
          {item.no_mayonnaise && <p className="mt-4 inline-flex rounded-full border border-amber-cafe/30 bg-amber-cafe/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-cafe">Prepared without mayonnaise</p>}

          <div className="mt-7">
            <p className="mb-2 text-sm font-semibold text-cocoa">Choose size</p>
            <div className="flex flex-wrap gap-2">{item.menu_item_sizes.map((option) => <button key={option.id} onClick={() => setSize(option)} className={`rounded-xl border px-4 py-2 text-sm ${size.id === option.id ? 'border-sage bg-sage/10 font-bold text-sage' : 'border-linen text-cocoa'}`}>{option.size_label} · {formatPrice(option.price_paise)}</button>)}</div>
          </div>
          {item.allow_extra_cheese && <label className="mt-5 flex cursor-pointer items-center justify-between rounded-xl border border-linen bg-cream-100 p-3 text-sm"><span className="font-semibold text-cocoa"><input type="checkbox" checked={extraCheese} onChange={(event) => setExtraCheese(event.target.checked)} className="mr-2 accent-sage" />Extra Cheese</span><span className="font-bold text-sage">+{formatPrice(cheesePrice)}</span></label>}
          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center rounded-xl border border-linen"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-3" aria-label="Decrease quantity"><Minus size={16} /></button><span className="min-w-8 text-center text-sm font-bold">{quantity}</span><button onClick={() => setQuantity(Math.min(25, quantity + 1))} className="p-3" aria-label="Increase quantity"><Plus size={16} /></button></div>
            <button onClick={add} className="btn-primary flex flex-1 items-center justify-center gap-2"><ShoppingBag size={17} /> Add · {formatPrice((size.price_paise + (extraCheese ? cheesePrice : 0)) * quantity)}</button>
          </div>
        </div>
      </div>
    </div>
  </main>
}
