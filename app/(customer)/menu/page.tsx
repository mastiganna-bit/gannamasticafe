import { createClient } from '@/lib/supabase/server'
import MenuClientPage from '@/components/menu/MenuClientPage'

export const metadata = {
  title: 'Menu | Gannamasti Cafe',
  description: 'Browse our full menu — Fresh Ganna Juice, Burgers, Pizzas, Milkshakes & more.',
}

export default async function MenuPage() {
  const supabase = await createClient()

  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('*, menu_item_sizes(*)')
    .eq('is_available', true)
    .order('created_at', { ascending: true })

  // Group by category
  const categories = [
    'The Cane Bar',
    'Refresher & Hot Brews',
    'Burger Binge',
    'Grill & Thrill Sandwiches',
    'Premium Loaded Pizza',
    'Pizzas',
    'Cheesy Sides & Bread Pizza',
    'Shake it up',
  ]

  return <MenuClientPage items={menuItems || []} categories={categories} />
}
