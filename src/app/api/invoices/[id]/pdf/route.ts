import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePDF } from '@/components/pdf/InvoicePDF'
import React from 'react'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const { id } = await params

    // Fetch invoice with seller/delivery man details
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        deliveryMan: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        lineItems: true
      }
    })

    if (!invoice) return new NextResponse('Invoice not found', { status: 404 })

    // Check access: seller can only view their own invoices, admin can view all
    if ((user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') && user.id !== invoice.sellerId) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    // Generate PDF using @react-pdf/renderer
    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoicePDF, {
        invoice: {
          id: invoice.id,
          ref: invoice.ref,
          createdAt: invoice.createdAt.toISOString(),
          dateFrom: invoice.dateFrom.toISOString(),
          dateTo: invoice.dateTo.toISOString(),
          status: invoice.status,
          subtotal: invoice.subtotal,
          vat: invoice.vat,
          totalNet: invoice.totalNet,
          cashCollected: invoice.cashCollected,
          refundedAmount: invoice.refundedAmount,
          cycleType: invoice.cycleType,
          seller: invoice.seller,
          deliveryMan: invoice.deliveryMan || undefined,
          lineItems: invoice.lineItems,
        }
      })
    )

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.ref}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      }
    })
  } catch (error) {
    console.error('Invoice PDF generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
