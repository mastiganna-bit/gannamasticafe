import { createClient } from '@/lib/supabase/server'
import MenuClientPage from '@/components/menu/MenuClientPage'

export const dynamic = 'force-dynamic'

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

  // Apply custom sorting
  const sortedItems = menuItems
    ? [...menuItems].sort((a, b) => {
        if (a.category === b.category && categoryItemOrders[a.category]) {
          const order = categoryItemOrders[a.category]
          const indexA = order.indexOf(a.name)
          const indexB = order.indexOf(b.name)

          if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB
          }
          if (indexA !== -1) return -1
          if (indexB !== -1) return 1
        }
        return 0 // keep database order
      })
    : []

  // Group by category
  const categories = [
    'The Cane Bar',
    'Refresher & Hot Brews',
    'Burger Binge',
    'Grill & Thrill Sandwiches',
    'Premium Loaded Pizza',
    'Single Topping Pizza',
    'Double Topping Pizza',
    'Cheesy Sides & Bread Pizza',
    'Shake it up',
  ]

  return <MenuClientPage items={sortedItems} categories={categories} />
}
