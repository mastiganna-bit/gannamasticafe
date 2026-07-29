'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Plus, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { MenuItem, MenuItemSize } from '@/lib/types'
import { formatPrice, isExtraCheeseEligible, getExtraCheesePrice, cn } from '@/lib/utils'
import { useCart } from '@/components/cart/CartProvider'

export default function MenuCard({ 
  item,
  cheesePrices
}: { 
  item: MenuItem
  cheesePrices?: { standard: number; premiumPizzaSmall: number; premiumPizzaOther: number; specialItem: number }
}) {
  const { addItem } = useCart()
  const [selectedSize, setSelectedSize] = useState<MenuItemSize>(() => {
    if (item.category === 'The Cane Bar') {
      const medium = item.menu_item_sizes.find(
        (size) => size.size_label.toLowerCase().trim() === 'medium'
      )
      if (medium) return medium
    }
    return item.menu_item_sizes[0]
  })
  const [isExpanded, setIsExpanded] = useState(false)
  const [extraCheese, setExtraCheese] = useState(false)

  const hasSizes = item.has_sizes && item.menu_item_sizes.length > 1

  // Dynamic image switching specifically for Ganna Juice sizes
  const isGannaJuice = item.category === 'The Cane Bar'
  
  let displayImagePath = item.image_path
  if (isGannaJuice && selectedSize) {
    const size = selectedSize.size_label.toLowerCase().trim()
    if (size === 'regular') displayImagePath = '/images/cane/ganna-regular.jpg'
    else if (size === 'medium') displayImagePath = '/images/cane/ganna-medium.jpg'
    else if (size === 'large') displayImagePath = '/images/cane/ganna-large.jpg'
    else if (size === 'extra large' || size === 'xl') displayImagePath = '/images/cane/ganna-xl.jpg'
    else if (size === 'jumbo') displayImagePath = '/images/cane/ganna-jumbo.jpg'
  }

  const eligibleForExtraCheese = !!item.allow_extra_cheese && item.category !== 'Shake it up'
  
  // Dynamic cheese price based on size
  const extraCheesePrice = eligibleForExtraCheese 
    ? getExtraCheesePrice(item.category || '', selectedSize.size_label, item.name, cheesePrices)
    : 0

  const handleAdd = () => {
    addItem({
      menu_item_id: item.id,
      size_id: selectedSize.id,
      name: item.name,
      size_label: selectedSize.size_label,
      price_paise: selectedSize.price_paise,
      quantity: 1,
      image_path: displayImagePath,
      extra_cheese: extraCheese,
      extra_cheese_price_paise: extraCheesePrice,
      category: item.category,
    })
    // Reset option after adding to cart for fresh selections
    setExtraCheese(false)
  }

  // Since Gannamasti Cafe is a 100% pure vegetarian establishment, all items are veg.
  const isVeg = true

  return (
    <div
      className={cn(
        "card bg-white flex flex-col h-full relative transition-all duration-300",
        isExpanded
          ? "z-30 shadow-card-hover"
          : "hover:-translate-y-1.5 hover:shadow-card-hover hover:z-20"
      )}
    >
      {/* Image Header with standard rounded-t-2xl (matches card's rounded-xl2 exactly) */}
      <div className="relative w-full aspect-square rounded-t-2xl overflow-hidden bg-cream-200 shrink-0">
        <img
          src={`${displayImagePath}?v=1.0.1`}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105 filter contrast-[1.02] saturate-[0.85] sepia-[0.08]"
          loading="lazy"
        />
        {/* Soft luxury designer blended overlay to tone down placeholder graphics */}
        <div className="absolute inset-0 bg-gradient-to-t from-cocoa/15 via-transparent to-cocoa/5 mix-blend-multiply opacity-40 pointer-events-none" />

        {!item.is_available && (
          <div className="absolute inset-0 bg-cream/80 flex items-center justify-center p-2 text-center z-10">
            <span className="font-sans text-[9px] xs:text-xs text-cocoa-muted font-medium bg-white px-2 py-0.5 xs:py-1 rounded-full border border-linen">
              Sold Out
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 xs:p-4 flex flex-col flex-1 min-w-0 bg-white rounded-b-2xl">
        {/* Category Label above Title */}
        {item.category && (
          <p className="font-serif italic text-[10px] text-sage/80 mb-0.5 tracking-wider">
            {item.category}
          </p>
        )}

        {/* Title and Veg/Non-Veg indicator */}
        <div className="flex items-start gap-1.5 mb-1 justify-between">
          <h3 className="font-serif text-sm xs:text-base font-semibold text-cocoa leading-tight truncate xs:whitespace-normal">
            {item.name}
          </h3>
          
          <div className="bg-white p-0.5 rounded border border-linen/30 flex items-center justify-center shrink-0 mt-0.5">
            <div className={cn(
              "w-2.5 h-2.5 border rounded-[2px] flex items-center justify-center p-[1.5px]",
              isVeg ? "border-emerald-600" : "border-red-600"
            )}>
              <div className={cn(
                "w-1 h-1 rounded-full",
                isVeg ? "bg-emerald-600" : "bg-red-600"
              )} />
            </div>
          </div>
        </div>

        {item.description && (
          <p className="font-sans text-[10px] xs:text-xs text-cocoa-muted leading-normal mb-3 line-clamp-1 xs:line-clamp-2">
            {item.description}
          </p>
        )}

        {hasSizes ? (
          <div className="mb-3 mt-auto">
            <p className="text-[10px] text-cocoa-muted font-medium mb-1">Select Size:</p>
            <div className="flex flex-wrap gap-2">
              {item.menu_item_sizes.map((size) => (
                <button
                  key={size.id}
                  onClick={() => setSelectedSize(size)}
                  className={cn(
                    "flex-1 min-w-[70px] py-1.5 px-2 rounded-lg border text-[10px] xs:text-xs font-sans transition-all duration-200 text-center cursor-pointer",
                    selectedSize.id === size.id
                      ? "border-sage bg-sage/10 text-sage font-bold shadow-sm"
                      : "border-linen bg-cream-100 hover:border-sage/30 hover:bg-cream-200 text-cocoa-muted hover:text-cocoa font-medium"
                  )}
                >
                  <div className="block">{size.size_label}</div>
                  <div className={selectedSize.id === size.id ? "text-sage" : "text-amber-cafe"}>
                    {formatPrice(size.price_paise)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-3 mt-auto flex items-end justify-between pt-2 border-t border-linen/30">
            <span className="font-sans text-[9px] xs:text-[10px] text-cocoa-muted uppercase tracking-widest font-medium">Price</span>
            <span className="font-sans font-bold text-amber-cafe text-xs xs:text-sm">
              {formatPrice(selectedSize.price_paise + (extraCheese ? extraCheesePrice : 0))}
            </span>
          </div>
        )}

        {/* Extra Cheese Premium Toggle Option */}
        {eligibleForExtraCheese && item.is_available && (
          <div className="mb-3.5 flex items-center justify-between p-2 rounded-xl bg-cream-100/30 border border-linen/40 transition-colors hover:bg-cream-100/60 select-none">
            <label className="flex items-center gap-2 cursor-pointer flex-1 py-0.5">
              <input
                type="checkbox"
                checked={extraCheese}
                onChange={(e) => setExtraCheese(e.target.checked)}
                className="w-4 h-4 rounded border-linen text-sage focus:ring-sage focus:ring-offset-0 cursor-pointer accent-sage"
              />
              <span className="font-sans text-[10px] xs:text-xs text-cocoa-muted flex items-center gap-1 font-medium">
                <span className="text-cocoa font-semibold">Extra Cheese</span>
              </span>
            </label>
            <span className="font-sans text-[9px] xs:text-[10px] text-sage font-semibold bg-sage/5 px-2 py-0.5 rounded-full border border-sage/10 shrink-0">
              +{formatPrice(extraCheesePrice)}
            </span>
          </div>
        )}

        {/* Premium Gourmet Add Button */}
        <button
          onClick={handleAdd}
          disabled={!item.is_available}
          className={cn(
            "w-full py-2.5 rounded-xl border border-sage text-cream-100 bg-sage font-sans font-medium text-[10px] xs:text-xs tracking-wider uppercase transition-all duration-300",
            "hover:bg-sage-dark hover:border-sage-dark active:scale-[0.97] shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer",
            !item.is_available && "opacity-40 cursor-not-allowed hover:bg-sage hover:text-cream-100 hover:border-sage hover:scale-100"
          )}
        >
          <Plus size={12} className="shrink-0" />
          <span>Add to Cart</span>
        </button>
      </div>
    </div>
  )
}
