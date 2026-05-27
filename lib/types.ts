export type MenuItemSize = {
  id: string
  menu_item_id: string
  size_label: string
  price_paise: number
  sort_order: number
}

export type MenuItem = {
  id: string
  name: string
  description: string | null
  category: string
  image_path: string
  is_available: boolean
  has_sizes: boolean
  created_at: string
  menu_item_sizes: MenuItemSize[]
}

export type CartItem = {
  menu_item_id: string
  size_id: string
  name: string
  size_label: string
  price_paise: number
  quantity: number
  image_path: string
}

export type OrderStatus = 'pending' | 'paid' | 'preparing' | 'completed' | 'cancelled'

export type Order = {
  id: string
  user_id: string | null
  customer_name: string
  customer_phone: string
  customer_email: string | null
  items: CartItem[]
  total_paise: number
  status: OrderStatus
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type Profile = {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  is_admin: boolean
  created_at: string
}

export type Notification = {
  id: string
  user_id: string
  order_id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

// Razorpay window type
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance
  }
}

export type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  image?: string
  order_id: string
  handler: (response: RazorpayResponse) => void
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
  theme?: {
    color?: string
  }
  modal?: {
    ondismiss?: () => void
  }
}

export type RazorpayResponse = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export type RazorpayInstance = {
  open: () => void
  on: (event: string, callback: () => void) => void
}
