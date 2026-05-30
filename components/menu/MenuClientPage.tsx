'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import MenuCard from './MenuCard'
import { MenuItem } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function MenuClientPage({
  items,
  categories,
}: {
  items: MenuItem[]
  categories: string[]
}) {
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  // Custom visual ordering for specific categories
  const categoryItemOrders: Record<string, string[]> = {
    'Refresher & Hot Brews': [
      'Lemon Masala Soda',
      'Lemonade',
      'Green Mint Mojito',
      'Watermelon Mojito',
      'Blue Lagoon Mojito',
      'Cold Coffee',
      'Hot Coffee',
    ]
  }

  // Sort dynamically in the client with a fully transitive, robust comparator
  const sortedItems = [...items].sort((a, b) => {
    // 1. First, group by category order as defined in the categories list
    const catIndexA = categories.indexOf(a.category)
    const catIndexB = categories.indexOf(b.category)

    if (catIndexA !== catIndexB) {
      return catIndexA - catIndexB
    }

    // 2. If they are in the same category, apply the custom visual order list
    if (categoryItemOrders[a.category]) {
      const order = categoryItemOrders[a.category]
      const indexA = order.indexOf(a.name)
      const indexB = order.indexOf(b.name)

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB
      }
      if (indexA !== -1) return -1
      if (indexB !== -1) return 1
    }

    // 3. Fallback to stable creation date sorting
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const allCategories = ['All', ...categories]

  // Smart search filter that honors both active categories and search queries
  const filtered = sortedItems.filter((item) => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  return (
    <div className="min-h-screen bg-cream pt-20">
      {/* Page Header with Responsive Title & Gourmet Search Bar */}
      <div className="bg-cream-200 border-b border-linen py-8 sm:py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4.5">
          <div>
            <p className="font-sans text-xs text-sage font-medium uppercase tracking-widest mb-1.5">
              What we serve
            </p>
            <h1 className="font-serif text-3xl md:text-5xl text-cocoa font-light">Our Menu</h1>
          </div>

          {/* Premium Ivory Glass Search Input */}
          <div className="relative w-full md:w-80 shrink-0">
            <input
              type="text"
              placeholder="Search our gourmet delights..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-linen bg-white/70 backdrop-blur-xs text-sm font-sans text-cocoa placeholder-cocoa-muted/60 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-sage/20 focus:border-sage focus:bg-white focus:shadow-sm"
            />
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cocoa-muted/70" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-cocoa-muted hover:bg-cream-200 transition-colors flex items-center justify-center cursor-pointer"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="sticky top-16 bg-cream/95 backdrop-blur-md border-b border-linen z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
          {/* Fade gradients for indicating swipeability on mobile */}
          <div className="absolute left-4 top-0 bottom-0 w-6 bg-gradient-to-r from-cream to-transparent pointer-events-none z-10 md:hidden" />
          <div className="absolute right-4 top-0 bottom-0 w-6 bg-gradient-to-l from-cream to-transparent pointer-events-none z-10 md:hidden" />

          <div className="flex gap-1.5 overflow-x-auto py-3 scrollbar-hide pr-6">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat)
                }}
                className={cn(
                  'shrink-0 px-3.5 py-2 rounded-lg font-sans text-xs font-medium transition-all duration-200 border cursor-pointer',
                  activeCategory === cat
                    ? 'bg-sage border-sage text-cream shadow-sm'
                    : 'text-cocoa-muted border-transparent hover:text-cocoa hover:bg-cream-200'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-10">
        {searchQuery.trim() !== '' ? (
          // If searching, show a unified flat search results feed
          <div>
            <div className="flex items-center justify-between gap-4 mb-6">
              <h2 className="font-serif text-lg md:text-xl text-cocoa font-medium">
                Search Results ({filtered.length})
              </h2>
              <div className="flex-1 h-px bg-linen" />
            </div>

            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((item) => (
                  <MenuCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 px-4 bg-white/40 border border-linen/30 rounded-2xl max-w-md mx-auto">
                <p className="font-serif text-lg text-cocoa font-medium mb-1.5">No gourmet delights found</p>
                <p className="font-sans text-xs text-cocoa-muted/70 mb-4">Try checking your spelling or search for another item.</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="btn-outline text-xs px-4.5 py-2 cursor-pointer hover:bg-sage hover:text-white hover:border-sage transition-all duration-300"
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>
        ) : activeCategory === 'All' ? (
          // Show grouped by category (Standard Menu layout)
          categories.map((category) => {
            const catItems = sortedItems.filter((i) => i.category === category)
            if (catItems.length === 0) return null
            return (
              <div key={category} className="mb-10 md:mb-12">
                <div className="flex items-center gap-4 mb-4 md:mb-6">
                  <h2 className="font-display text-xl md:text-2xl text-cocoa">{category}</h2>
                  {category === 'Cheesy Sides & Bread Pizza' && (
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-emerald-200/40 flex items-center gap-1 shrink-0 shadow-3xs">
                      🌿 No Mayonnaise Used
                    </span>
                  )}
                  <div className="flex-1 h-px bg-linen" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {catItems.map((item) => (
                    <MenuCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          // Show selected category flat feed
          <div>
            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((item) => (
                  <MenuCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 px-4 bg-white/40 border border-linen/30 rounded-2xl max-w-md mx-auto">
                <p className="font-serif text-lg text-cocoa font-medium mb-1">No items found</p>
                <p className="font-sans text-xs text-cocoa-muted/70">Check back later or explore other sections.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
