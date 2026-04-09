import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { withAuditContext } from '@/lib/api-context'

// GET /api/invoices
export async function GET() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const invoices = await db.invoice.findMany({
      where: (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') ? {} : { sellerId: user.id },
      include: {
        seller: { select: { id: true, name: true, email: true } },
        deliveryMan: { select: { id: true, name: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ invoices })
  } catch (error) {
    console.error('Invoices GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/invoices - Admin creates invoice for a seller for a date range
export async function POST(req: NextRequest) {
  return withAuditContext(async () => {
    try {
      const user = await getSession()
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const body = await req.json()
      const { sellerId, dateFrom, dateTo, deliveryManId, vat = 0 } = body

      if (!sellerId || !dateFrom || !dateTo) {
        return NextResponse.json({ error: 'Missing sellerId, dateFrom, dateTo' }, { status: 400 })
      }

      const from = new Date(dateFrom)
      const to = new Date(dateTo + 'T23:59:59')

      // Calculate delivered orders in period for this seller
      const deliveredOrders = await db.order.findMany({
        where: {
          sellerId,
          status: 'DELIVERED',
          deliveredAt: { gte: from, lte: to }
        },
        select: { codAmount: true }
      })

      const returnedOrders = await db.order.findMany({
        where: {
          sellerId,
          status: 'RETURNED',
          returnedAt: { gte: from, lte: to }
        },
        select: { codAmount: true }
      })

      const cashCollected = deliveredOrders.reduce((s, o) => s + o.codAmount, 0)
      const refundedAmount = returnedOrders.reduce((s, o) => s + o.codAmount, 0)
      const totalPlatformFees = deliveredOrders.reduce((s, o) => s + (o.platformFee || 5000), 0)
      const subtotal = cashCollected - refundedAmount - totalPlatformFees
      const vatAmount = subtotal * (vat / 100)
      const totalNet = subtotal - vatAmount

      // Generate unique ref
      const ref = `INV-${Date.now().toString(36).toUpperCase()}`

      const invoice = await db.invoice.create({
        data: {
          sellerId,
          deliveryManId: deliveryManId || undefined,
          ref,
          cashCollected,
          refundedAmount,
          subtotal,
          vat: vatAmount,
          totalNet,
          status: 'UNPAID',
          dateFrom: from,
          dateTo: to
        },
        include: { seller: { select: { id: true, name: true, email: true } } }
      })

      return NextResponse.json({ invoice }, { status: 201 })
    } catch (error) {
      console.error('Invoices POST error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}

// PATCH /api/invoices/[id] - Update invoice status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuditContext(async () => {
    try {
      const user = await getSession()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const { id } = await params
      const body = await req.json()
      const { status, isLocked } = body

      const invoice = await db.invoice.findUnique({ where: { id } })
      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      }

      // Admin can update any invoice
      // Delivery man can only update if assigned to them
      if (user.role !== 'ADMIN' && invoice.deliveryManId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      // Prevent modification if locked (only admin can override)
      if (invoice.isLocked && user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Invoice is locked' }, { status: 403 })
      }

      const updateData: Record<string, unknown> = {}
      if (status) updateData.status = status
      if (isLocked !== undefined && user.role === 'ADMIN') {
        updateData.isLocked = isLocked
      }

      await db.invoice.update({
        where: { id },
        data: updateData
      })

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Invoices PATCH error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}
