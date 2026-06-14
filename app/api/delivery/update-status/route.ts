import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createClient()
    const { data: { user } } = await supabaseServer.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check if user has a driver profile
    const adminSupabase = createAdminClient()
    const { data: driver } = await adminSupabase
      .from('delivery_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!driver) {
      return NextResponse.json({ error: 'Access denied: No delivery agent profile found' }, { status: 403 })
    }

    const { orderId, action }: { orderId: string; action: 'accept' | 'pickup' | 'deliver' } = await request.json()

    if (!orderId || !action) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // Fetch order to verify state
    const { data: order, error: fetchError } = await adminSupabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (action === 'accept') {
      if (order.delivery_status !== 'unassigned') {
        return NextResponse.json({ error: 'Order is already accepted by another driver' }, { status: 400 })
      }

      const { error } = await adminSupabase
        .from('orders')
        .update({
          delivery_boy_id: user.id,
          delivery_status: 'assigned',
        })
        .eq('id', orderId)

      if (error) throw error
      return NextResponse.json({ success: true, message: 'Order accepted' })
    }

    if (action === 'pickup') {
      if (order.delivery_boy_id !== user.id) {
        return NextResponse.json({ error: 'You are not assigned to this order' }, { status: 403 })
      }
      if (order.delivery_status !== 'assigned') {
        return NextResponse.json({ error: 'Invalid state transition' }, { status: 400 })
      }

      const { error } = await adminSupabase
        .from('orders')
        .update({
          delivery_status: 'picked_up',
        })
        .eq('id', orderId)

      if (error) throw error
      return NextResponse.json({ success: true, message: 'Order picked up' })
    }

    if (action === 'deliver') {
      if (order.delivery_boy_id !== user.id) {
        return NextResponse.json({ error: 'You are not assigned to this order' }, { status: 403 })
      }
      if (order.delivery_status !== 'picked_up') {
        return NextResponse.json({ error: 'Invalid state transition' }, { status: 400 })
      }

      const { error } = await adminSupabase
        .from('orders')
        .update({
          delivery_status: 'delivered',
          status: 'completed', // Ensure the main order is completed
        })
        .eq('id', orderId)

      if (error) throw error

      // Clean up delivery locations for this order since delivery is complete
      await adminSupabase
        .from('delivery_locations')
        .delete()
        .eq('order_id', orderId)

      return NextResponse.json({ success: true, message: 'Order delivered' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Update delivery status error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
