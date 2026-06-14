import { createAdminClient } from './admin'
import webpush from 'web-push'

// Initialize VAPID keys for secure push notification transmission
if (
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_SUBJECT
) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
} else {
  console.warn('[Web Push] VAPID credentials missing in environment variables. Lock screen notifications disabled.')
}

export async function createOrderStatusNotification(orderId: string, status: string) {
  try {
    const supabase = createAdminClient()
    
    // Fetch order details
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, user_id, customer_name, items, delivery_type')
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
        if (order.delivery_type === 'delivery') {
          title = 'Order Prepared! 🍔📦'
          message = `Hi ${order.customer_name}! Your order is prepared and is being packed for delivery.`
        } else {
          title = 'Order Ready! 🍔🥤'
          message = `Hi ${order.customer_name}! Your order is ready at the counter. Come grab it while it is hot!`
        }
        break
      case 'picked_up':
      case 'out_for_delivery':
        title = 'Out for Delivery! 🛵'
        message = `Hi ${order.customer_name}! Your order has been picked up by our delivery partner and is on the way!`
        break
      case 'delivered':
        title = 'Order Delivered! 🍕🎉'
        message = `Hi ${order.customer_name}! Your order was delivered successfully. Enjoy your hot food!`
        break
      case 'cancelled':
        title = 'Order Cancelled ❌'
        message = `Hi ${order.customer_name}! Your order has been cancelled. Please contact the counter for details.`
        break
      default:
        return // No notification for pending or unknown statuses
    }

    // 1. Insert standard database notification log
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
      console.error(`Error inserting notification log for order ${orderId}:`, insertError)
    }

    // 2. Fetch push subscriptions associated with this user ID
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', order.user_id)

    if (subError) {
      console.error('Error fetching push subscriptions:', subError)
      return
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No active push subscriptions found for user ${order.user_id}`)
      return
    }

    // 3. Prepare payload JSON structure
    const payload = JSON.stringify({
      title,
      body: message,
      icon: '/images/logo.png',
      badge: '/images/logo.png',
      url: `/account`,
    })

    // 4. Dispatch Web Push requests to all user devices in parallel
    const pushPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          auth: sub.keys_auth,
          p256dh: sub.keys_p256dh,
        },
      }

      try {
        await webpush.sendNotification(pushSubscription, payload)
        console.log(`[Web Push] Successfully dispatched message to: ${sub.endpoint.substring(0, 40)}...`)
      } catch (err: any) {
        // Automatically delete invalid, expired, or deactivated subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[Web Push] Sub expired (status ${err.statusCode}). Cleaning up endpoint: ${sub.endpoint.substring(0, 40)}...`)
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint)
        } else {
          console.error(`[Web Push] Error for endpoint ${sub.endpoint.substring(0, 40)}...:`, err)
        }
      }
    })

    await Promise.allSettled(pushPromises)

  } catch (error) {
    console.error('Failed to create order status notification:', error)
  }
}
