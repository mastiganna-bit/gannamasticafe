import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ItemDetailClient from '@/components/menu/ItemDetailClient'

export const dynamic = 'force-dynamic'

export default async function MenuItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: item } = await supabase.from('menu_items')
    .select('*,menu_item_sizes(*)')
    .eq('id', id).eq('is_available', true).is('archived_at', null).single()
  if (!item) notFound()
  item.menu_item_sizes = (item.menu_item_sizes || [])
    .filter((size: { is_available?: boolean }) => size.is_available !== false)
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
  if (!item.menu_item_sizes.length) notFound()
  return <ItemDetailClient item={item} />
}
