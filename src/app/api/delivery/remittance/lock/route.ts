import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

/**
 * POST /api/delivery/remittance/lock
 * Lock delivery cycle and create invoice
 * ADMIN only
 */
export async function POST(request: NextRequest) {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { deliveryManId } = body

    if (!deliveryManId) {
      return NextResponse.json({ error: 'deliveryManId is required' }, { status: 400 })
    }

    // Verify delivery man exists
    const deliveryMan = await db.user.findFirst({
      where: { id: deliveryManId, role: 'DELIVERY', isActive: true }
    })

    if (!deliveryMan) {
      return NextResponse.json({ error: 'Delivery man not found' }, { status: 404 })
    }

    // Today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Check if already locked
    const existingInvoice = await db.invoice.findFirst({
      where: {
        deliveryManId,
        cycleType: 'DELIVERY',
        isLocked: true,
        createdAt: { gte: today, lt: tomorrow }
      }
    })

    if (existingInvoice) {
      return NextResponse.json(
        { error: 'Remittance already locked for today', invoice: existingInvoice },
        { status: 409 }
      )
    }

    // Get today's delivered orders
    const orders = await db.order.findMany({
      where: {
        deliveryManId,
        status: 'DELIVERED',
        updatedAt: { gte: today, lt: tomorrow }
      }
    })

    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'No delivered orders found for today' },
        { status: 400 }
      )
    }

    // Calculate totals
    const totalCash = orders.reduce((sum, o) => sum + o.codAmount, 0)
    const orderCodes = orders.map(o => o.trackingNumber).join(', ')

    // Create locked invoice
    const invoice = await db.invoice.create({
      data: {
        sellerId: user.id, // Admin acts as seller for delivery invoices
        deliveryManId,
        ref: `REM-${deliveryMan.name.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
        cashCollected: totalCash,
        refundedAmount: 0,
        subtotal: totalCash,
        vat: 0,
        totalNet: totalCash,
        status: 'UNPAID',
        cycleType: 'DELIVERY',
        isLocked: true,
        dateFrom: today,
        dateTo: tomorrow
      }
    })

    // Log activity
    await logActivity(
      user.id,
      user.role,
      'REMITTANCE_LOCK',
      `Locked remittance for delivery man ${deliveryMan.name}: ${orders.length} orders, ${totalCash.toFixed(2)} MAD. Invoice: ${invoice.ref}`
    )

    return NextResponse.json(
      {
        invoice,
        ordersCount: orders.length,
        totalCash,
        orderCodes
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error locking remittance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
