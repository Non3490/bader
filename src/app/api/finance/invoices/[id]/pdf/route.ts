import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// GET /api/finance/invoices/[id]/pdf — Download invoice PDF
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const invoice = await db.invoice.findUnique({
      where: { id: params.id },
      include: {
        seller: { select: { id: true, name: true, email: true, phone: true } },
        deliveryMan: { select: { id: true, name: true, email: true, phone: true } },
        lineItems: true
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Check permissions
    if (user.role === 'SELLER' && invoice.sellerId !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Generate PDF
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // Header
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('INVOICE', pageWidth / 2, 20, { align: 'center' })

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Invoice #: ${invoice.ref}`, pageWidth / 2, 30, { align: 'center' })

    // Period
    doc.setFontSize(10)
    doc.text(`Period: ${new Date(invoice.dateFrom).toLocaleDateString()} - ${new Date(invoice.dateTo).toLocaleDateString()}`, pageWidth / 2, 37, { align: 'center' })

    // Seller/Delivery Man Info
    let partyName = invoice.cycleType === 'SELLER' ? invoice.seller?.name : invoice.deliveryMan?.name
    let partyContact = invoice.cycleType === 'SELLER' ? invoice.seller?.email : invoice.deliveryMan?.email

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(invoice.cycleType === 'SELLER' ? 'Seller' : 'Delivery Man', 20, 50)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Name: ${partyName}`, 20, 58)
    doc.text(`Contact: ${partyContact}`, 20, 65)

    // Line Items Table
    autoTable(doc, {
      startY: 80,
      head: [['Description', 'Quantity', 'Unit Price (XAF)', 'Amount (XAF)']],
      body: invoice.lineItems.map((item) => [
        item.description,
        item.quantity.toString(),
        item.unitPrice.toFixed(2),
        item.amount.toFixed(2)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [240, 112, 32], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 40, halign: 'right' },
        3: { cellWidth: 40, halign: 'right' }
      }
    })

    // Totals
    let finalY = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Subtotal:', 130, finalY)
    doc.text(`${invoice.subtotal.toFixed(2)} XAF`, 190, finalY, { align: 'right' })

    finalY += 8
    doc.text('VAT:', 130, finalY)
    doc.text(`${invoice.vat.toFixed(2)} XAF`, 190, finalY, { align: 'right' })

    finalY += 8
    doc.setFontSize(12)
    doc.text('Total Net:', 130, finalY)
    doc.text(`${invoice.totalNet.toFixed(2)} XAF`, 190, finalY, { align: 'right' })

    // Status
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Status: ${invoice.status}`, 20, finalY)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, finalY + 8)

    // Footer
    doc.setFontSize(8)
    doc.text('E-Gabon Prime — COD Platform', pageWidth / 2, pageHeight - 10, { align: 'center' })

    // Return PDF
    const pdfBytes = doc.output('arraybuffer')
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.ref}.pdf"`
      }
    })
  } catch (error) {
    console.error('Invoice PDF GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
