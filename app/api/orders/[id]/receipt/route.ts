import { NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { requireUser } from '@/lib/server/auth'
import { apiErrorResponse, ApiError } from '@/lib/server/errors'
import { createAdminClient } from '@/lib/supabase/admin'

const money = (paise: number | null | undefined) => `INR ${((paise || 0) / 100).toFixed(2)}`

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser()
    const { id } = await context.params
    const admin = createAdminClient()
    const { data: order } = await admin.from('orders').select('*,order_items(*)').eq('id', id).single()
    if (!order) throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND')
    const isAdmin = session.profile.is_admin || session.profile.role === 'admin'
    if (!isAdmin && order.user_id !== session.user.id) throw new ApiError(403, 'Receipt access denied.', 'FORBIDDEN')

    const document = new jsPDF({ unit: 'pt', format: 'a4' })
    document.setFont('helvetica', 'bold'); document.setFontSize(20); document.text('Gannamasti Cafe', 40, 48)
    document.setFont('helvetica', 'normal'); document.setFontSize(10)
    document.text('Order receipt (not a tax invoice)', 40, 67)
    document.text(`Order: ${order.invoice_number || `GM-${order.order_number || String(order.id).slice(0, 8).toUpperCase()}`}`, 40, 91)
    document.text(`Placed: ${new Date(order.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 40, 106)
    document.text(`Customer: ${order.customer_name} | ${order.customer_phone}`, 40, 121)
    document.text(`Fulfilment: ${String(order.delivery_type || 'takeaway').replace('_', ' ')} | Payment: ${order.payment_method === 'cod' ? 'Cash on delivery' : 'Online'}`, 40, 136)
    const address = [order.delivery_house, order.delivery_area, order.delivery_landmark, order.delivery_city].filter(Boolean).join(', ')
    if (address) document.text(`Address: ${address}`, 40, 151, { maxWidth: 515 })

    autoTable(document, {
      startY: address ? 176 : 160,
      head: [['Item', 'Size', 'Qty', 'Unit', 'Add-ons', 'Line total']],
      body: (order.order_items || []).map((item: Record<string, unknown>) => [
        String(item.item_name || ''), String(item.size_label || ''), String(Number(item.quantity) - Number(item.cancelled_quantity || 0)),
        money(Number(item.unit_price_paise)), money(Number(item.addon_total_paise)), money(Number(item.line_total_paise)),
      ]),
      styles: { font: 'helvetica', fontSize: 9 }, headStyles: { fillColor: [43, 94, 67] },
    })
    const finalY = (document as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 250
    const rows = [
      ['Items', money(order.items_subtotal_paise)], ['Packaging', money(order.packaging_fee_paise)],
      ['Platform fee', money(order.platform_fee_paise)], ['Delivery', money(order.delivery_fee_paise)],
      ['Pickup discount', `- ${money(order.discount_paise)}`], ['Total', money(order.total_paise)],
    ]
    autoTable(document, { startY: finalY + 16, body: rows, theme: 'plain', styles: { fontSize: 10 }, columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }, margin: { left: 320 } })
    document.setFontSize(8); document.setTextColor(90); document.text(`Payment reference: ${order.razorpay_payment_id || (order.payment_method === 'cod' ? 'COD' : 'Pending')}`, 40, 800)
    const bytes = Buffer.from(document.output('arraybuffer'))
    return new NextResponse(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Gannamasti-${order.order_number || order.id}.pdf"`, 'Cache-Control': 'private, no-store' } })
  } catch (error) { return apiErrorResponse(error) }
}
