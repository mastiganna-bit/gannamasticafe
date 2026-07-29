import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Order } from '@/lib/types'
import { formatPrice } from '@/lib/utils'

export const generateOrderPDF = (order: Order) => {
  const doc = new jsPDF()
  
  // Header
  doc.setFontSize(22)
  doc.text('Gannamasti Cafe', 105, 20, { align: 'center' })
  
  doc.setFontSize(14)
  doc.text(`Detailed Bill / Invoice`, 105, 30, { align: 'center' })
  
  doc.setFontSize(10)
  doc.text(`Order ID: #${order.id.slice(0, 8).toUpperCase()}`, 14, 45)
  doc.text(`Date: ${new Date(order.created_at).toLocaleString()}`, 14, 52)
  doc.text(`Customer: ${order.customer_name}`, 14, 59)
  doc.text(`Phone: ${order.customer_phone}`, 14, 66)
  
  let currentY = 73
  if (order.delivery_type === 'delivery' && order.delivery_address) {
    doc.text(`Delivery Address: ${order.delivery_address.replace(/q=.*$/, '').replace(/\n/g, ' ')}`, 14, currentY, { maxWidth: 180 })
    currentY += 7
  } else if (order.delivery_type === 'dine_in') {
    doc.text(`Order Type: Dine-In`, 14, currentY)
    currentY += 7
  } else {
    doc.text(`Order Type: Takeaway`, 14, currentY)
    currentY += 7
  }

  doc.text(`Order Status: ${(order.status || 'Unknown').toUpperCase()}`, 14, currentY)
  doc.text(`Payment: ${(order.payment_status || 'Paid').toUpperCase()}`, 105, currentY)
  currentY += 10
  
  // Items Table
  const items = order.items as any[]
  
  let calculatedSubtotal = 0;
  let sugarcaneQty = 0;
  let discountAmount = 0;
  
  const tableData = items.map(item => {
    let sizeText = item.size_label || 'Regular'
    let unitPrice = item.price_paise
    
    if (item.extra_cheese) {
      sizeText += ' (+ Cheese)'
      if (item.extra_cheese_price_paise) {
        unitPrice += item.extra_cheese_price_paise
      }
    }
    
    const itemTotal = unitPrice * item.quantity
    calculatedSubtotal += itemTotal

    const isSugarcane = item.name?.toLowerCase().includes('sugarcane') ||
                        item.name?.toLowerCase().includes('ganna') ||
                        item.category?.toLowerCase().includes('cane')
    if (isSugarcane) {
      sugarcaneQty += item.quantity
    } else if (order.delivery_type === 'takeaway') {
      discountAmount += Math.round(0.10 * unitPrice * item.quantity)
    }
    
    return [
      item.name,
      sizeText,
      item.quantity.toString(),
      formatPrice(unitPrice),
      formatPrice(itemTotal)
    ]
  })
  
  let finalY = currentY;

  autoTable(doc, {
    startY: finalY,
    head: [['Item', 'Size & Add-ons', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [82, 107, 72] }, // Sage green matching theme
  })
  
  finalY = (doc as any).lastAutoTable.finalY + 10
  
  // Totals
  doc.setFontSize(10)
  doc.text(`Subtotal: ${formatPrice(calculatedSubtotal)}`, 140, finalY)
  
  const packagingFee = sugarcaneQty * 500;
  const platformFee = 600;
  const deliveryFee = order.delivery_type === 'delivery' && calculatedSubtotal < 29900 ? 5000 : 0;
  
  const expectedTotal = calculatedSubtotal + packagingFee + platformFee + deliveryFee - discountAmount;
  
  if (packagingFee > 0) {
    finalY += 7
    doc.text(`Packaging Fee: ${formatPrice(packagingFee)}`, 140, finalY)
  }
  if (platformFee > 0) {
    finalY += 7
    doc.text(`Platform Fee: ${formatPrice(platformFee)}`, 140, finalY)
  }
  if (deliveryFee > 0) {
    finalY += 7
    doc.text(`Delivery Fee: ${formatPrice(deliveryFee)}`, 140, finalY)
  }
  if (discountAmount > 0) {
    finalY += 7
    doc.text(`Takeaway Discount: -${formatPrice(discountAmount)}`, 140, finalY)
  }

  const mismatch = order.total_paise - expectedTotal;
  if (Math.abs(mismatch) > 1) { // >1 paise tolerance
    finalY += 7;
    if (mismatch > 0) {
       doc.text(`Other Adjustments: ${formatPrice(mismatch)}`, 140, finalY)
    } else {
       doc.text(`Other Discounts: -${formatPrice(Math.abs(mismatch))}`, 140, finalY)
    }
  }
  
  finalY += 10
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`Grand Total: ${formatPrice(order.total_paise)}`, 140, finalY)
  
  // Footer
  finalY += 20
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Thank you for choosing Gannamasti Cafe!', 105, finalY, { align: 'center' })
  
  // Download
  doc.save(`Gannamasti_Receipt_${order.id.slice(0, 8)}.pdf`)
}
