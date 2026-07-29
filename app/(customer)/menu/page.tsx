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

  // Filter out system items
  const displayItems = sortedItems.filter(i => i.category !== 'System')

  // Group by category, dynamically pulling from DB but preserving specific top-level order
  const dbCategories = Array.from(new Set(displayItems.map(i => i.category)))
  const defaultCategoryOrder = [
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
  const newDynamicCategories = dbCategories.filter(cat => !defaultCategoryOrder.includes(cat))
  const categories = [
    ...defaultCategoryOrder.filter(cat => dbCategories.includes(cat)), 
    ...newDynamicCategories
  ]

  // Fetch cheese prices
  const systemItem = menuItems?.find(i => i.category === 'System' && i.name === 'Extra Cheese Settings')
  const cheesePrices = {
    standard: 2000,
    premiumPizzaSmall: 3000,
    premiumPizzaOther: 5000,
    specialItem: 3000
  }

  if (systemItem && systemItem.menu_item_sizes) {
    const sizes = systemItem.menu_item_sizes as any[]
    const std = sizes.find(s => s.size_label === 'Standard Price')
    const premSmall = sizes.find(s => s.size_label === 'Premium Pizza (Small/Half) Price')
    const premOther = sizes.find(s => s.size_label === 'Premium Pizza (Medium/Large) Price')
    const spec = sizes.find(s => s.size_label === 'Special Item Price')

    if (std) cheesePrices.standard = std.price_paise
    if (premSmall) cheesePrices.premiumPizzaSmall = premSmall.price_paise
    if (premOther) cheesePrices.premiumPizzaOther = premOther.price_paise
    if (spec) cheesePrices.specialItem = spec.price_paise
  }

  return <MenuClientPage items={displayItems} categories={categories} cheesePrices={cheesePrices} />
}
