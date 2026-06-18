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
  image_backup?: string | null
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
  const [editImagePath, setEditImagePath] = useState('')
  const [editBackupPath, setEditBackupPath] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [editAvailability, setEditAvailability] = useState(true)
  const [editSizes, setEditSizes] = useState<Size[]>([])
  const [editSinglePrice, setEditSinglePrice] = useState<number>(0) // For items without sizes

  // Confirmation Modal state
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<{
    itemId: string
    name: string
    description: string
    image_path: string
    is_available: boolean
    sizes: Size[]
    singlePricePaise?: number // For non-sizes
    diffList: string[]
  } | null>(null)
  const [saving, setSaving] = useState(false)

  // Add new item states
  const [showAddModal, setShowAddModal] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemDesc, setNewItemDesc] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('')
  const [newItemImagePath, setNewItemImagePath] = useState('')
  const [newItemHasSizes, setNewItemHasSizes] = useState(false)
  const [newItemSinglePrice, setNewItemSinglePrice] = useState<number>(0)
  const [newItemSizes, setNewItemSizes] = useState<{ label: string; price: number }[]>([
    { label: 'Regular', price: 0 }
  ])
  const [savingNewItem, setSavingNewItem] = useState(false)

  // Extra cheese pricing settings
  const [cheesePrices, setCheesePrices] = useState({
    std: 20,
    premSmall: 30,
    premOther: 50,
    spec: 30
  })
  const [savingCheese, setSavingCheese] = useState(false)

  useEffect(() => {
    fetchMenuItems()
  }, [])

  const fetchMenuItems = async () => {
    setLoading(true)
    try {
      // 1. Fetch normal menu items
      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          *,
          menu_item_sizes(*)
        `)
        .order('category')

      if (error) throw error
      
      // Filter out system row
      const filtered = (data as MenuItem[] || []).filter(item => item.id !== '00000000-0000-0000-0000-000000000000')
      setItems(filtered)

      // 2. Fetch cheese settings
      const { data: systemItem } = await supabase
        .from('menu_items')
        .select('*, menu_item_sizes(*)')
        .eq('id', '00000000-0000-0000-0000-000000000000')
        .single()

      if (systemItem && systemItem.menu_item_sizes) {
        const sizes = systemItem.menu_item_sizes as any[]
        const stdSize = sizes.find(s => s.size_label === 'Standard Price')
        const premSmallSize = sizes.find(s => s.size_label === 'Premium Pizza (Small/Half) Price')
        const premOtherSize = sizes.find(s => s.size_label === 'Premium Pizza (Medium/Large) Price')
        const specSize = sizes.find(s => s.size_label === 'Special Item Price')

        setCheesePrices({
          std: stdSize ? stdSize.price_paise / 100 : 20,
          premSmall: premSmallSize ? premSmallSize.price_paise / 100 : 30,
          premOther: premOtherSize ? premOtherSize.price_paise / 100 : 50,
          spec: specSize ? specSize.price_paise / 100 : 30
        })
      }
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
    setEditImagePath(item.image_path || '')
    setEditBackupPath(item.image_backup || null)
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

  // Handle uploading image files and setting state
  const handleUploadImageFile = async (file: File, forNewItem = false) => {
    setUploadingImage(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload image')
      }

      if (forNewItem) {
        setNewItemImagePath(data.url)
        toast.success('New item image uploaded successfully!')
      } else {
        // Backup the current image path
        if (editImagePath && editImagePath !== data.url) {
          setEditBackupPath(editImagePath)
        }
        setEditImagePath(data.url)
        toast.success('Image uploaded successfully! Current image staged as backup.')
      }
    } catch (err: any) {
      toast.error('Image upload failed: ' + err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  const restoreBackupImage = () => {
    if (editBackupPath) {
      const temp = editImagePath
      setEditImagePath(editBackupPath)
      setEditBackupPath(temp)
      toast.success('Restored previous image from backup!')
    }
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
    if (editImagePath !== item.image_path) {
      diffList.push(`Update image: "${item.image_path}" → "${editImagePath}"`)
      if (editBackupPath) {
        diffList.push(`Backup current image: "${editBackupPath}"`)
      }
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
      image_path: editImagePath,
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
      const updatePayload: any = {
        name: pendingChanges.name,
        description: pendingChanges.description || null,
        image_path: pendingChanges.image_path,
        is_available: pendingChanges.is_available
      }

      const currentItem = items.find(i => i.id === pendingChanges.itemId)
      if (currentItem && 'image_backup' in currentItem) {
        updatePayload.image_backup = editBackupPath || currentItem.image_backup || null
      }

      const { error: itemErr } = await supabase
        .from('menu_items')
        .update(updatePayload)
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

  // Save cheese prices
  const handleSaveCheesePrices = async () => {
    setSavingCheese(true)
    try {
      const sizesToUpdate = [
        { label: 'Standard Price', price: cheesePrices.std * 100 },
        { label: 'Premium Pizza (Small/Half) Price', price: cheesePrices.premSmall * 100 },
        { label: 'Premium Pizza (Medium/Large) Price', price: cheesePrices.premOther * 100 },
        { label: 'Special Item Price', price: cheesePrices.spec * 100 }
      ]

      for (const sz of sizesToUpdate) {
        const { error } = await supabase
          .from('menu_item_sizes')
          .update({ price_paise: sz.price })
          .eq('menu_item_id', '00000000-0000-0000-0000-000000000000')
          .eq('size_label', sz.label)

        if (error) throw error
      }

      toast.success('Extra Cheese prices updated successfully!')
    } catch (err: any) {
      toast.error('Failed to save cheese prices: ' + err.message)
    } finally {
      setSavingCheese(false)
    }
  }

  // Add new item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName || !newItemCategory) {
      toast.error('Please enter name and category')
      return
    }

    setSavingNewItem(true)
    try {
      // 1. Insert item
      const insertPayload: any = {
        name: newItemName,
        description: newItemDesc || null,
        category: newItemCategory,
        image_path: newItemImagePath || '/images/logo.png',
        is_available: true,
        has_sizes: newItemHasSizes
      }

      if (items.length > 0 && 'image_backup' in items[0]) {
        insertPayload.image_backup = null
      }

      const { data: itemData, error: itemErr } = await supabase
        .from('menu_items')
        .insert(insertPayload)
        .select()
        .single()

      if (itemErr) throw itemErr

      // 2. Insert sizes
      if (newItemHasSizes) {
        for (let idx = 0; idx < newItemSizes.length; idx++) {
          const sz = newItemSizes[idx]
          const { error: szErr } = await supabase
            .from('menu_item_sizes')
            .insert({
              menu_item_id: itemData.id,
              size_label: sz.label,
              price_paise: Math.round(sz.price * 100),
              sort_order: idx + 1
            })
          if (szErr) throw szErr
        }
      } else {
        const { error: szErr } = await supabase
          .from('menu_item_sizes')
          .insert({
            menu_item_id: itemData.id,
            size_label: 'Regular',
            price_paise: Math.round(newItemSinglePrice * 100),
            sort_order: 1
          })
        if (szErr) throw szErr
      }

      toast.success('New menu item added successfully!')
      // Reset form
      setNewItemName('')
      setNewItemDesc('')
      setNewItemCategory('')
      setNewItemImagePath('')
      setNewItemHasSizes(false)
      setNewItemSinglePrice(0)
      setNewItemSizes([{ label: 'Regular', price: 0 }])
      setShowAddModal(false)
      fetchMenuItems()
    } catch (err: any) {
      toast.error('Failed to add item: ' + err.message)
    } finally {
      setSavingNewItem(false)
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
      
      {/* 1. Cheese Price Settings Panel */}
      <div className="bg-cream-200 border border-linen rounded-xl2 p-5 shadow-card">
        <h3 className="font-serif text-base text-cocoa font-bold mb-1 flex items-center gap-2">
          🧀 Extra Cheese Pricing Settings (System-wide)
        </h3>
        <p className="font-sans text-xs text-cocoa-muted mb-4">
          Adjust the prices charged for adding extra cheese to items in different categories. Updates take effect instantly at checkout.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white p-3 rounded-xl border border-linen space-y-1">
            <span className="block text-[10px] font-sans font-bold text-cocoa-muted uppercase">Standard Price</span>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-cocoa-muted text-xs">₹</span>
              <input
                type="number"
                value={cheesePrices.std}
                onChange={e => setCheesePrices(prev => ({ ...prev, std: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-cream border border-linen rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-cocoa font-mono font-bold"
              />
            </div>
          </div>
          
          <div className="bg-white p-3 rounded-xl border border-linen space-y-1">
            <span className="block text-[10px] font-sans font-bold text-cocoa-muted uppercase">Premium Pizza (Small/Half)</span>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-cocoa-muted text-xs">₹</span>
              <input
                type="number"
                value={cheesePrices.premSmall}
                onChange={e => setCheesePrices(prev => ({ ...prev, premSmall: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-cream border border-linen rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-cocoa font-mono font-bold"
              />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-linen space-y-1">
            <span className="block text-[10px] font-sans font-bold text-cocoa-muted uppercase">Premium Pizza (Med/Large)</span>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-cocoa-muted text-xs">₹</span>
              <input
                type="number"
                value={cheesePrices.premOther}
                onChange={e => setCheesePrices(prev => ({ ...prev, premOther: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-cream border border-linen rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-cocoa font-mono font-bold"
              />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-linen space-y-1">
            <span className="block text-[10px] font-sans font-bold text-cocoa-muted uppercase">Special Item Price</span>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-cocoa-muted text-xs">₹</span>
              <input
                type="number"
                value={cheesePrices.spec}
                onChange={e => setCheesePrices(prev => ({ ...prev, spec: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-cream border border-linen rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-cocoa font-mono font-bold"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSaveCheesePrices}
            disabled={savingCheese}
            className="bg-sage hover:bg-sage-dark text-white font-sans text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            {savingCheese ? 'Saving Settings...' : 'Save Cheese Prices'}
          </button>
        </div>
      </div>

      {/* 2. Search and control bar */}
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
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-sage hover:bg-sage-dark text-white font-sans text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            <Plus size={14} />
            Add Menu Item
          </button>
          <div className="font-sans text-xs text-cocoa-muted flex items-center gap-1.5 shrink-0 px-1 border-l border-linen pl-3">
            <span>Total catalog: {items.length} items</span>
          </div>
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

                            <div>
                              <label className="block text-[9px] font-sans font-bold text-cocoa uppercase mb-2">Product Image</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Upload / Preview Box */}
                                <div className="relative group aspect-video rounded-xl border-2 border-dashed border-linen hover:border-sage transition-all bg-cream flex flex-col items-center justify-center p-3 cursor-pointer overflow-hidden text-center">
                                  {uploadingImage ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <div className="w-5 h-5 border-2 border-sage/20 border-t-sage rounded-full animate-spin" />
                                      <span className="text-[9px] text-sage font-bold font-sans">Uploading...</span>
                                    </div>
                                  ) : editImagePath ? (
                                    <>
                                      <img
                                        src={editImagePath}
                                        alt="Preview"
                                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      />
                                      <div className="absolute inset-0 bg-cocoa/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9px] font-bold font-sans gap-1">
                                        <Plus size={16} />
                                        <span>Change Image</span>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-cocoa-muted flex flex-col items-center gap-1">
                                      <Plus size={18} className="text-sage" />
                                      <span className="text-[9px] font-bold font-sans uppercase">Upload Image</span>
                                    </div>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    disabled={uploadingImage}
                                    onChange={e => {
                                      const file = e.target.files?.[0]
                                      if (file) handleUploadImageFile(file, false)
                                    }}
                                  />
                                </div>

                                {/* Backup Box */}
                                <div className="border border-linen rounded-xl p-3 bg-cream/30 flex flex-col justify-between text-[10px]">
                                  {editBackupPath ? (
                                    <div className="flex flex-col justify-between h-full gap-2">
                                      <div>
                                        <span className="text-[8px] font-bold text-cocoa-muted uppercase block">Backup History</span>
                                        <div className="flex items-center gap-2 mt-1.5">
                                          <div className="w-8 h-8 rounded-lg bg-cream border border-linen overflow-hidden relative shrink-0">
                                            <img src={editBackupPath} className="w-full h-full object-cover" alt="Backup" />
                                          </div>
                                          <span className="text-[9px] text-cocoa truncate max-w-[100px]" title={editBackupPath}>
                                            {editBackupPath.split('/').pop()}
                                          </span>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={restoreBackupImage}
                                        className="w-full bg-white hover:bg-sage/10 text-sage border border-sage/20 hover:border-sage font-bold font-sans py-1.5 px-2.5 rounded-lg transition-all text-[9px] flex items-center justify-center gap-1"
                                      >
                                        🔄 Restore Backup
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center text-cocoa-muted py-2">
                                      <span className="text-[9px] italic">No backup image available</span>
                                      <p className="text-[8px] mt-1 leading-normal text-cocoa-muted/70">
                                        Uploading a new image will automatically archive the current one.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Manual URL entry field for power-users */}
                              <div className="mt-2.5">
                                <label className="block text-[8px] font-sans font-bold text-cocoa-muted uppercase mb-1">Or edit image path/URL manually</label>
                                <input
                                  type="text"
                                  value={editImagePath}
                                  onChange={e => setEditImagePath(e.target.value)}
                                  className="w-full bg-cream border border-linen rounded-lg p-2 text-xs text-cocoa focus:outline-none focus:ring-1 focus:ring-sage"
                                />
                              </div>

                              {items.length > 0 && !('image_backup' in items[0]) && (
                                <p className="mt-1.5 text-[8px] text-amber-cafe font-sans leading-normal">
                                  ⚠️ Run the SQL migration `add_image_backup.sql` to save backup images.
                                </p>
                              )}
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
                              <div className="w-16 h-16 rounded-xl bg-cream border border-linen overflow-hidden shrink-0 flex items-center justify-center relative">
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

      {/* Add New Menu Item Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-cocoa/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white max-w-lg w-full border border-linen rounded-2xl p-6 shadow-lg space-y-4 my-8"
            >
              <div className="flex items-center justify-between border-b border-linen pb-3">
                <h4 className="font-serif text-lg text-cocoa font-bold">✨ Add New Menu Item</h4>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg hover:bg-cream border border-linen text-cocoa-muted"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddItem} className="space-y-4 text-xs font-sans text-cocoa">
                <div>
                  <label className="block text-[10px] font-sans font-bold text-cocoa-muted uppercase mb-1">Item Title *</label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={e => setNewItemName(e.target.value)}
                    placeholder="e.g. Gannamasti Special Pizza"
                    className="w-full bg-cream border border-linen rounded-lg p-2.5 text-xs text-cocoa focus:outline-none focus:ring-1 focus:ring-sage"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-sans font-bold text-cocoa-muted uppercase mb-1">Description</label>
                  <textarea
                    value={newItemDesc}
                    onChange={e => setNewItemDesc(e.target.value)}
                    placeholder="Describe ingredients, taste profile, and preparation style..."
                    rows={3}
                    className="w-full bg-cream border border-linen rounded-lg p-2.5 text-xs text-cocoa focus:outline-none focus:ring-1 focus:ring-sage resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-sans font-bold text-cocoa-muted uppercase mb-1">Category *</label>
                    <input
                      type="text"
                      required
                      value={newItemCategory}
                      onChange={e => setNewItemCategory(e.target.value)}
                      placeholder="e.g. Premium Loaded Pizza"
                      className="w-full bg-cream border border-linen rounded-lg p-2.5 text-xs text-cocoa focus:outline-none focus:ring-1 focus:ring-sage"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans font-bold text-cocoa-muted uppercase mb-1.5">Product Image</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Upload Box */}
                      <div className="relative group aspect-video rounded-xl border-2 border-dashed border-linen hover:border-sage transition-all bg-cream flex flex-col items-center justify-center p-3 cursor-pointer overflow-hidden text-center">
                        {uploadingImage ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-5 h-5 border-2 border-sage/20 border-t-sage rounded-full animate-spin" />
                            <span className="text-[9px] text-sage font-bold font-sans">Uploading...</span>
                          </div>
                        ) : newItemImagePath ? (
                          <>
                            <img
                              src={newItemImagePath}
                              alt="Preview"
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-cocoa/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9px] font-bold font-sans gap-1">
                              <Plus size={16} />
                              <span>Change Image</span>
                            </div>
                          </>
                        ) : (
                          <div className="text-cocoa-muted flex flex-col items-center gap-1">
                            <Plus size={18} className="text-sage" />
                            <span className="text-[9px] font-bold font-sans uppercase">Upload Image</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          disabled={uploadingImage}
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadImageFile(file, true)
                          }}
                        />
                      </div>

                      {/* Manual Entry box */}
                      <div className="border border-linen rounded-xl p-3 bg-cream/30 flex flex-col justify-center text-[10px]">
                        <span className="text-[8px] font-bold text-cocoa-muted uppercase block mb-1.5">Or enter URL manually</span>
                        <input
                          type="text"
                          value={newItemImagePath}
                          onChange={e => setNewItemImagePath(e.target.value)}
                          placeholder="e.g. /images/special-pizza.png"
                          className="w-full bg-cream border border-linen rounded-lg p-2 text-xs text-cocoa focus:outline-none focus:ring-1 focus:ring-sage"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-linen/50 pt-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-cocoa">Does this product have multiple sizes?</span>
                    <button
                      type="button"
                      onClick={() => setNewItemHasSizes(!newItemHasSizes)}
                      className={`font-sans text-[10px] font-bold py-1 px-3 rounded-full border transition-all ${
                        newItemHasSizes 
                          ? 'bg-sage/10 text-sage border-sage/20' 
                          : 'bg-cream text-cocoa-muted border-linen'
                      }`}
                    >
                      {newItemHasSizes ? 'Multi-size' : 'Single standard price'}
                    </button>
                  </div>

                  {newItemHasSizes ? (
                    <div className="space-y-2">
                      <span className="block text-[9px] font-bold text-cocoa-muted uppercase mb-1">Sizes & Pricing (₹)</span>
                      {newItemSizes.map((sz, idx) => (
                        <div key={idx} className="flex gap-3 items-center">
                          <input
                            type="text"
                            required
                            placeholder="Size Label (e.g. Small)"
                            value={sz.label}
                            onChange={e => {
                              const next = [...newItemSizes]
                              next[idx].label = e.target.value
                              setNewItemSizes(next)
                            }}
                            className="flex-1 bg-cream border border-linen rounded-lg p-2 text-xs text-cocoa"
                          />
                          <div className="relative w-28">
                            <span className="absolute left-2.5 top-1.5 text-cocoa-muted">₹</span>
                            <input
                              type="number"
                              required
                              placeholder="Price"
                              value={sz.price || ''}
                              onChange={e => {
                                const next = [...newItemSizes]
                                next[idx].price = parseFloat(e.target.value) || 0
                                setNewItemSizes(next)
                              }}
                              className="w-full bg-cream border border-linen rounded-lg pl-6 pr-2 py-1.5 text-xs text-cocoa font-mono text-right"
                            />
                          </div>
                          {newItemSizes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setNewItemSizes(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setNewItemSizes(prev => [...prev, { label: '', price: 0 }])}
                        className="text-[10px] font-bold text-sage hover:underline flex items-center gap-1 mt-1"
                      >
                        + Add Size option
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[9px] font-sans font-bold text-cocoa-muted uppercase mb-1">Standard Item Price (₹)</label>
                      <div className="relative max-w-[140px]">
                        <span className="absolute left-2.5 top-2 text-cocoa-muted">₹</span>
                        <input
                          type="number"
                          required
                          value={newItemSinglePrice || ''}
                          onChange={e => setNewItemSinglePrice(parseFloat(e.target.value) || 0)}
                          placeholder="Price"
                          className="w-full bg-cream border border-linen rounded-lg pl-6 pr-2 py-2 text-xs text-cocoa font-mono text-right"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2.5 pt-4 border-t border-linen/50">
                  <button
                    type="submit"
                    disabled={savingNewItem}
                    className="flex-1 bg-sage hover:bg-sage-dark text-white font-sans text-xs font-bold py-3 rounded-xl active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
                  >
                    {savingNewItem ? 'Creating...' : 'Create Menu Item'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="bg-cream hover:bg-linen border border-linen text-cocoa font-sans text-xs font-bold py-3 px-4 rounded-xl active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
