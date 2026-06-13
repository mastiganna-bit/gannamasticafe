import { createAdminClient } from './admin'

export async function createOrderStatusNotification(orderId: string, status: string) {
  try {
    const supabase = createAdminClient()
    
    // Fetch order details
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, user_id, customer_name, items')
      .eq('id', orderId)
      .single()

    if (fetchError || !order) {
      console.error(`Error fetching order ${orderId} for notification:`, fetchError)
      return
    }

    if (!order.user_id) {
      console.log(`Order ${orderId} has no user_id, skipping notification creation.`)
      return
    }

    // Calculate item count
    const items = (order.items as any[]) || []
    const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0)

    let title = ''
    let message = ''

    switch (status) {
      case 'paid':
        title = 'Order Confirmed! 🎉'
        message = `Hi ${order.customer_name}! Your order of ${itemCount} item${itemCount > 1 ? 's' : ''} has been confirmed. Our kitchen is preparing it!`
        break
      case 'preparing':
        title = 'Preparing Your Order 🍳'
        message = `Hi ${order.customer_name}! Our chef has started preparing your delicious food!`
        break
      case 'completed':
        title = 'Order Ready! 🍔🥤'
        message = `Hi ${order.customer_name}! Your order is ready at the counter. Come grab it while it is hot!`
        break
      case 'cancelled':
        title = 'Order Cancelled ❌'
        message = `Hi ${order.customer_name}! Your order has been cancelled. Please contact the counter for details.`
        break
      default:
        return // No notification for pending or unknown statuses
    }

    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: order.user_id,
        order_id: order.id,
        title,
        message,
        is_read: false,
      })

    if (insertError) {
      console.error(`Error inserting notification for order ${orderId}:`, insertError)
    } else {
      console.log(`Successfully created '${status}' notification for user ${order.user_id}`)
    }
  } catch (error) {
    console.error('Failed to create order status notification:', error)
  }
}
