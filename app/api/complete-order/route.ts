import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    // Verify admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { order_id } = await request.json()

    if (!order_id) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // Get order details
    const { data: order, error: orderError } = await adminSupabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Update order to completed
    const { error: updateError } = await adminSupabase
      .from('orders')
      .update({ status: 'completed' })
      .eq('id', order_id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }

    // Create notification for user
    if (order.user_id) {
      await adminSupabase
        .from('notifications')
        .insert({
          user_id: order.user_id,
          order_id: order.id,
          title: 'Your order is ready! 🎉',
          message: `Hi ${order.customer_name}! Your order of ${formatItemsCount(order.items as Array<{ quantity: number }>)} items is ready. Come pick it up!`,
          is_read: false,
        })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Complete order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatItemsCount(items: Array<{ quantity: number }>): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}
