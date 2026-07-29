'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Save, Settings } from 'lucide-react'

interface StoreSettingsData {
  platform_fee: number
  packing_charge_per_item: number
  delivery_discount: number
}

export default function StoreSettings() {
  const [settings, setSettings] = useState<StoreSettingsData>({
    platform_fee: 0,
    packing_charge_per_item: 5,
    delivery_discount: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No settings found, use defaults
          setSettings({
            platform_fee: 0,
            packing_charge_per_item: 5,
            delivery_discount: 0,
          })
        } else {
          console.warn('Store settings table might be missing or inaccessible:', error.message || error)
          setSettings({
            platform_fee: 0,
            packing_charge_per_item: 5,
            delivery_discount: 0,
          })
        }
      } else if (data) {
        setSettings({
          platform_fee: Number(data.platform_fee),
          packing_charge_per_item: Number(data.packing_charge_per_item),
          delivery_discount: Number(data.delivery_discount),
        })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      toast.error('Failed to load store settings.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      // Check if row exists
      const { data: existingData } = await supabase
        .from('store_settings')
        .select('id')
        .limit(1)
        .single()

      if (existingData) {
        // Update
        const { error } = await supabase
          .from('store_settings')
          .update({
            platform_fee: settings.platform_fee,
            packing_charge_per_item: settings.packing_charge_per_item,
            delivery_discount: settings.delivery_discount,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingData.id)

        if (error) throw error
      } else {
        // Insert
        const { error } = await supabase
          .from('store_settings')
          .insert([{
            platform_fee: settings.platform_fee,
            packing_charge_per_item: settings.packing_charge_per_item,
            delivery_discount: settings.delivery_discount,
          }])
        
        if (error) throw error
      }

      toast.success('Store settings updated successfully!')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings. Make sure you have admin rights.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setSettings(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }))
  }

  if (isLoading) {
    return <div className="p-8 text-center text-cocoa-muted font-sans text-sm animate-pulse">Loading settings...</div>
  }

  return (
    <div className="bg-white rounded-xl shadow-card border border-linen p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6 border-b border-linen pb-4">
        <div className="bg-sage/10 p-2 rounded-lg text-sage">
          <Settings size={20} />
        </div>
        <div>
          <h2 className="font-display text-xl text-cocoa">Store Fees & Configurations</h2>
          <p className="font-sans text-xs text-cocoa-muted">Manage global charges and discounts applied at checkout.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block font-sans text-sm font-semibold text-cocoa mb-1">
              Platform Fee (₹)
            </label>
            <p className="text-[10px] text-cocoa-muted mb-2">Flat fee added to every order for platform usage.</p>
            <input
              type="number"
              name="platform_fee"
              min="0"
              step="0.01"
              value={settings.platform_fee}
              onChange={handleChange}
              className="w-full bg-cream border border-linen rounded-xl px-4 py-3 font-sans text-cocoa focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage transition-all"
              required
            />
          </div>

          <div>
            <label className="block font-sans text-sm font-semibold text-cocoa mb-1">
              Sugarcane Packing Charge (₹)
            </label>
            <p className="text-[10px] text-cocoa-muted mb-2">Per-item fee applied to sugarcane/ganna items.</p>
            <input
              type="number"
              name="packing_charge_per_item"
              min="0"
              step="0.01"
              value={settings.packing_charge_per_item}
              onChange={handleChange}
              className="w-full bg-cream border border-linen rounded-xl px-4 py-3 font-sans text-cocoa focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage transition-all"
              required
            />
          </div>

          <div>
            <label className="block font-sans text-sm font-semibold text-cocoa mb-1">
              Delivery Discount / Penalty (₹)
            </label>
            <p className="text-[10px] text-cocoa-muted mb-2">Use positive number for discount, negative for extra delivery fee on all orders.</p>
            <input
              type="number"
              name="delivery_discount"
              step="0.01"
              value={settings.delivery_discount}
              onChange={handleChange}
              className="w-full bg-cream border border-linen rounded-xl px-4 py-3 font-sans text-cocoa focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage transition-all"
              required
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-sage hover:bg-sage-dark text-white font-sans font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
