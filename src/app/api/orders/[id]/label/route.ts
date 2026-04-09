import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { renderToBuffer } from '@react-pdf/renderer'
import { ShippingLabelPDF } from '@/components/pdf/ShippingLabelPDF'
import React from 'react'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const order = await db.order.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true } }
      }
    })

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Access check
    if (user.role === 'SELLER' && order.sellerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const pdfBuffer = await renderToBuffer(
      React.createElement(ShippingLabelPDF, {
        order: {
          trackingNumber: order.trackingNumber,
          recipientName: order.recipientName,
          phone: order.phone,
          address: order.address,
          city: order.city,
          codAmount: order.codAmount,
          seller: order.seller,
          status: order.status,
        }
      })
    )

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="label-${order.trackingNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      }
    })
  } catch (error) {
    console.error('Label PDF error:', error)
    return NextResponse.json({ error: 'Failed to generate label' }, { status: 500 })
  }
}
