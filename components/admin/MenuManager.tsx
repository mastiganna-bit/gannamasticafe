'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Edit2, Check, X, Search, AlertTriangle, 
  EyeOff, Eye, Plus, Trash2, IndianRupee, Save 
} from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

interface Size {
  id: string
  menu_item_id: string
  size_label: string
  price_paise: number
}

interface MenuItem {
  id: string
  name: string
  description: string | null
  category: string
  image_path: string
  is_available: boolean
  has_sizes: boolean
  menu_item_sizes?: Size[]
}

export default function MenuManager() {
  const supabase = createClient()
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Form edit states
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editAvailability, setEditAvailability] = useState(true)
  const [editSizes, setEditSizes] = useState<Size[]>([])
  const [editSinglePrice, setEditSinglePrice] = useState<number>(0) // For items without sizes

  // Confirmation Modal state
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<{
    itemId: string
    name: string
    description: string
    is_available: boolean
    sizes: Size[]
    singlePricePaise?: number // For non-sizes
    diffList: string[]
  } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchMenuItems()
  }, [])

  const fetchMenuItems = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          *,
          menu_item_sizes(*)
        `)
        .order('category')

      if (error) throw error
      setItems(data as MenuItem[] || [])
    } catch (err: any) {
      toast.error('Failed to load menu: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Start inline editing
  const startEditing = (item: MenuItem) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditDesc(item.description || '')
    setEditAvailability(item.is_available)
    if (item.has_sizes && item.menu_item_sizes) {
      setEditSizes([...item.menu_item_sizes])
    } else if (item.menu_item_sizes && item.menu_item_sizes.length > 0) {
      setEditSinglePrice(item.menu_item_sizes[0].price_paise)
      setEditSizes([...item.menu_item_sizes])
    } else {
      setEditSinglePrice(0)
      setEditSizes([])
    }
  }

  const cancelEditing = () => {
    setEditingId(null)
  }

  // Handle price inputs safely
  const handleSizePriceChange = (sizeId: string, val: string) => {
    const num = Math.round(parseFloat(val) * 100)
    if (isNaN(num)) return
    setEditSizes(prev => prev.map(s => s.id === sizeId ? { ...s, price_paise: num } : s))
  }

  // Validate changes & compile a diff checklist
  const handleRequestSave = (item: MenuItem) => {
    const diffList: string[] = []

    if (editName !== item.name) {
      diffList.push(`Rename item: "${item.name}" → "${editName}"`)
    }
    if (editDesc !== (item.description || '')) {
      diffList.push(`Update description`)
    }
    if (editAvailability !== item.is_available) {
      diffList.push(`Availability: ${item.is_available ? 'Available' : 'Hidden'} → ${editAvailability ? 'Available' : 'Hidden'}`)
    }

    if (item.has_sizes && item.menu_item_sizes) {
      editSizes.forEach(newSize => {
        const oldSize = item.menu_item_sizes?.find(s => s.id === newSize.id)
        if (oldSize && oldSize.price_paise !== newSize.price_paise) {
          diffList.push(
            `Price (${newSize.size_label}): ${formatPrice(oldSize.price_paise)} → ${formatPrice(newSize.price_paise)}`
          )
        }
      })
    } else if (item.menu_item_sizes && item.menu_item_sizes.length > 0) {
      const oldPrice = item.menu_item_sizes[0].price_paise
      if (oldPrice !== editSinglePrice) {
        diffList.push(
          `Price: ${formatPrice(oldPrice)} → ${formatPrice(editSinglePrice)}`
        )
      }
    }

    if (diffList.length === 0) {
      setEditingId(null)
      toast('No changes detected', { icon: 'ℹ️' })
      return
    }

    // Open Safety Protocol Confirmation Modal
    setPendingChanges({
      itemId: item.id,
      name: editName,
      description: editDesc,
      is_available: editAvailability,
      sizes: editSizes,
      singlePricePaise: !item.has_sizes ? editSinglePrice : undefined,
      diffList
    })
    setShowConfirm(true)
  }

  // Commit changes to Supabase
  const handleConfirmSave = async () => {
    if (!pendingChanges) return
    setSaving(true)

    try {
      // 1. Update main menu item details
      const { error: itemErr } = await supabase
        .from('menu_items')
        .update({
          name: pendingChanges.name,
          description: pendingChanges.description || null,
          is_available: pendingChanges.is_available
        })
        .eq('id', pendingChanges.itemId)

      if (itemErr) throw itemErr

      // 2. Update sizes pricing
      if (pendingChanges.singlePricePaise !== undefined && pendingChanges.sizes.length > 0) {
        // Single price item
        const { error: sizeErr } = await supabase
          .from('menu_item_sizes')
          .update({
            price_paise: pendingChanges.singlePricePaise
          })
          .eq('id', pendingChanges.sizes[0].id)

        if (sizeErr) throw sizeErr
      } else {
        // Multi-size item
        for (const size of pendingChanges.sizes) {
          const { error: sizeErr } = await supabase
            .from('menu_item_sizes')
            .update({
              price_paise: size.price_paise
            })
            .eq('id', size.id)

          if (sizeErr) throw sizeErr
        }
      }

      toast.success('Product updated successfully!')
      setEditingId(null)
      setShowConfirm(false)
      fetchMenuItems()
    } catch (err: any) {
      toast.error('Failed to save changes: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Toggle item availability quickly
  const toggleQuickAvailability = async (item: MenuItem) => {
    const nextVal = !item.is_available
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: nextVal })
        .eq('id', item.id)

      if (error) throw error
      
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: nextVal } : i))
      toast.success(`${item.name} is now ${nextVal ? 'Visible' : 'Hidden'}`)
    } catch (err: any) {
      toast.error('Failed to toggle visibility')
    }
  }

  // Filter items
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Group items by category
  const categories = Array.from(new Set(items.map(i => i.category)))

  return (
    <div className="space-y-6">
      
      {/* Search and control bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-linen p-4 rounded-xl2 shadow-sm">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3.5 text-cocoa-muted" />
          <input
            type="text"
            placeholder="Search items by name or category..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-cream border border-linen rounded-xl pl-9 pr-4 py-2.5 text-xs text-cocoa focus:outline-none focus:ring-1 focus:ring-sage"
          />
        </div>
        <div className="font-sans text-xs text-cocoa-muted flex items-center gap-1.5 shrink-0 px-1">
          <span>Total catalog: {items.length} items</span>
        </div>
      </div>

      {/* Catalog items */}
      {loading ? (
        <div className="text-center py-20 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-sage/20 border-t-sage rounded-full animate-spin" />
          <p className="font-sans text-xs text-cocoa-muted">Loading menu catalog...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-linen p-12 text-center rounded-xl2 shadow-sm">
          <p className="font-sans text-xs text-cocoa-muted">No items matched your search query.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map(category => {
            const catItems = filteredItems.filter(i => i.category === category)
            if (catItems.length === 0) return null

            return (
              <div key={category} className="space-y-4">
                <h3 className="font-serif text-base text-cocoa border-b border-linen pb-2 font-medium tracking-wide uppercase">
                  {category}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {catItems.map(item => {
                    const isEditing = editingId === item.id

                    return (
                      <div 
                        key={item.id} 
                        className={`bg-white border rounded-xl2 p-4 shadow-sm transition-all flex flex-col justify-between ${
                          isEditing ? 'border-sage ring-1 ring-sage/35' : 'border-linen/75 hover:border-linen-dark'
                        }`}
                      >
                        {isEditing ? (
                          /* EDITING LAYOUT */
                          <div className="space-y-3.5">
                            <div>
                              <label className="block text-[9px] font-sans font-bold text-cocoa uppercase mb-1">Product Title</label>
                              <input
                                type="text"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="w-full bg-cream border border-linen rounded-lg p-2 text-xs text-cocoa focus:outline-none focus:ring-1 focus:ring-sage"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-[9px] font-sans font-bold text-cocoa uppercase mb-1">Description</label>
                              <textarea
                                value={editDesc}
                                onChange={e => setEditDesc(e.target.value)}
                                rows={2}
                                className="w-full bg-cream border border-linen rounded-lg p-2 text-xs text-cocoa focus:outline-none focus:ring-1 focus:ring-sage resize-none"
                              />
                            </div>

                            <div className="flex items-center justify-between py-1">
                              <span className="text-xs font-sans text-cocoa font-medium">Catalog Visibility Status</span>
                              <button
                                type="button"
                                onClick={() => setEditAvailability(!editAvailability)}
                                className={`font-sans text-[10px] font-bold py-1 px-3 rounded-full border transition-all ${
                                  editAvailability 
                                    ? 'bg-sage/10 text-sage border-sage/20' 
                                    : 'bg-red-50 text-red-700 border-red-200'
                                }`}
                              >
                                {editAvailability ? '✓ Active (Visible)' : '👁️ Hidden (Sold Out)'}
                              </button>
                            </div>

                            {/* Pricing inputs */}
                            <div className="border-t border-linen/60 pt-3">
                              <label className="block text-[9px] font-sans font-bold text-cocoa uppercase mb-2">Price Details (₹)</label>
                              {item.has_sizes ? (
                                <div className="space-y-2">
                                  {editSizes.map(size => (
                                    <div key={size.id} className="flex items-center justify-between gap-3 text-xs">
                                      <span className="font-sans text-cocoa-muted w-16">{size.size_label}</span>
                                      <div className="relative flex-1 max-w-[120px]">
                                        <span className="absolute left-2.5 top-2 text-cocoa-muted font-sans">₹</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          defaultValue={(size.price_paise / 100).toFixed(2)}
                                          onChange={e => handleSizePriceChange(size.id, e.target.value)}
                                          className="w-full bg-cream border border-linen rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-cocoa text-right focus:outline-none focus:ring-1 focus:ring-sage font-mono"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-3 text-xs">
                                  <span className="font-sans text-cocoa-muted">Standard Price</span>
                                  <div className="relative flex-1 max-w-[120px]">
                                    <span className="absolute left-2.5 top-2 text-cocoa-muted font-sans">₹</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      defaultValue={(editSinglePrice / 100).toFixed(2)}
                                      onChange={e => {
                                        const num = Math.round(parseFloat(e.target.value) * 100)
                                        if (!isNaN(num)) setEditSinglePrice(num)
                                      }}
                                      className="w-full bg-cream border border-linen rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-cocoa text-right focus:outline-none focus:ring-1 focus:ring-sage font-mono"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Editing Controls */}
                            <div className="flex gap-2 pt-3 border-t border-linen/50">
                              <button
                                onClick={() => handleRequestSave(item)}
                                className="flex-1 bg-sage hover:bg-sage-dark text-white font-sans text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                              >
                                <Save size={13} />
                                Save
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="bg-cream hover:bg-linen border border-linen text-cocoa font-sans text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition-all active:scale-[0.98] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* STANDARD DISPLAY LAYOUT */
                          <div className="flex flex-col h-full justify-between gap-3">
                            <div className="flex gap-3 min-w-0">
                              <div className="w-16 h-16 rounded-xl bg-cream border border-linen overflow-hidden shrink-0 flex items-center justify-center">
                                <img 
                                  src={item.image_path} 
                                  alt={item.name} 
                                  className="w-full h-full object-cover" 
                                  onError={(e)=>{
                                    e.currentTarget.src = "/images/logo.png"
                                  }}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-serif text-sm font-semibold text-cocoa truncate">{item.name}</h4>
                                  {!item.is_available && (
                                    <span className="bg-red-50 text-red-700 text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-red-200 uppercase tracking-wide shrink-0">
                                      Hidden
                                    </span>
                                  )}
                                </div>
                                <p className="font-sans text-[11px] text-cocoa-muted line-clamp-2 mt-0.5 min-h-[32px]">
                                  {item.description || 'No description provided.'}
                                </p>
                              </div>
                            </div>

                            {/* Prices display */}
                            <div className="border-t border-linen/50 pt-2.5 flex items-center justify-between">
                              <div className="flex gap-2.5 overflow-x-auto py-0.5">
                                {item.has_sizes && item.menu_item_sizes ? (
                                  item.menu_item_sizes.map(size => (
                                    <div key={size.id} className="text-[10px] font-sans bg-cream border border-linen px-2 py-0.5 rounded-md shrink-0">
                                      <span className="text-cocoa-muted">{size.size_label}: </span>
                                      <span className="font-bold text-cocoa">{formatPrice(size.price_paise)}</span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-xs font-sans font-bold text-cocoa">
                                    {item.menu_item_sizes && item.menu_item_sizes.length > 0 
                                      ? formatPrice(item.menu_item_sizes[0].price_paise)
                                      : '₹0.00'
                                    }
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                                <button
                                  onClick={() => toggleQuickAvailability(item)}
                                  title={item.is_available ? 'Hide from catalog' : 'Make active'}
                                  className={`p-1.5 rounded-lg border transition-colors ${
                                    item.is_available 
                                      ? 'bg-cream border-linen hover:bg-linen text-cocoa-muted' 
                                      : 'bg-red-50 border-red-200 hover:bg-red-100 text-red-600'
                                  }`}
                                >
                                  {item.is_available ? <Eye size={13} /> : <EyeOff size={13} />}
                                </button>
                                
                                <button
                                  onClick={() => startEditing(item)}
                                  className="bg-cream hover:bg-linen border border-linen text-cocoa p-1.5 rounded-lg flex items-center justify-center transition-colors"
                                >
                                  <Edit2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Safety Protocol Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && pendingChanges && (
          <div className="fixed inset-0 bg-cocoa/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white max-w-md w-full border border-linen rounded-2xl p-6 shadow-lg space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-cafe flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 className="font-serif text-base text-cocoa font-semibold">Confirm Price / Catalog Modifications</h4>
                  <p className="font-sans text-xs text-cocoa-muted mt-1">Please audit the requested changes carefully before pushing to production:</p>
                </div>
              </div>

              <div className="bg-cream border border-linen rounded-xl p-3.5 space-y-2">
                <span className="block text-[9px] font-sans font-bold text-cocoa-muted uppercase tracking-wider">Change Summary:</span>
                <ul className="list-disc pl-4 space-y-1 text-xs font-sans text-cocoa">
                  {pendingChanges.diffList.map((diff, idx) => (
                    <li key={idx} className="leading-normal font-medium">{diff}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-amber-50/70 border border-amber-200/50 p-3 rounded-xl text-[10px] font-sans text-amber-800 leading-normal">
                ⚠️ Price fluctuations will update Razorpay carts instantly. Active client checkout transactions will adapt on refresh.
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={handleConfirmSave}
                  disabled={saving}
                  className="flex-1 bg-sage hover:bg-sage-dark text-white font-sans text-xs font-bold py-3 rounded-xl active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Yes, Confirm Modifications'}
                </button>
                <button
                  onClick={() => {
                    setShowConfirm(false)
                    setPendingChanges(null)
                  }}
                  disabled={saving}
                  className="bg-cream hover:bg-linen border border-linen text-cocoa font-sans text-xs font-bold py-3 px-4 rounded-xl active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
                >
                  Discard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
