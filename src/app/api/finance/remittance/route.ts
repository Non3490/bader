import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

// GET /api/finance/remittance - Get locked remittance records
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const locks = await db.remittanceLock.findMany({
      include: {
        deliveryMan: { select: { id: true, name: true } }
      },
      orderBy: { lockedAt: 'desc' },
      take: 100
    })

    return NextResponse.json(locks)
  } catch (error) {
    console.error('Get remittance locks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/finance/remittance/lock - Lock remittance period for delivery man
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { deliveryManId, dateFrom, dateTo, cashCollected } = body

    if (!deliveryManId || !dateFrom || !dateTo || cashCollected === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get delivery man info
    const deliveryMan = await db.user.findUnique({
      where: { id: deliveryManId },
      select: { name: true }
    })

    if (!deliveryMan) {
      return NextResponse.json({ error: 'Delivery man not found' }, { status: 404 })
    }

    // Count delivered orders in period
    const deliveredOrders = await db.order.count({
      where: {
        deliveryManId,
        status: 'DELIVERED',
        deliveredAt: {
          gte: new Date(dateFrom),
          lte: new Date(dateTo)
        }
      }
    })

    // Get delivery fee config
    const feeConfig = await db.deliveryFeeConfig.findUnique({
      where: { deliveryManId }
    })
    const costPerDelivery = feeConfig?.costPerDelivery || 0
    const deliveryFees = deliveredOrders * costPerDelivery

    // Create remittance lock record
    const remittanceLock = await db.remittanceLock.create({
      data: {
        deliveryManId,
        periodStart: new Date(dateFrom),
        periodEnd: new Date(dateTo),
        cashCollected,
        deliveryCount: deliveredOrders,
        totalFees: deliveryFees,
        netDue: cashCollected - deliveryFees,
        status: 'LOCKED'
      }
    })

    // Create invoice for this remittance
    const invoice = await db.invoice.create({
      data: {
        sellerId: user.id, // Admin acts as seller for remittance
        deliveryManId,
        ref: `REM-${dateFrom.split('T')[0]}-${deliveryManId.substring(0, 6)}`,
        cashCollected,
        subtotal: cashCollected,
        vat: 0,
        totalNet: cashCollected - deliveryFees,
        status: 'PAID',
        cycleType: 'DELIVERY',
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
        isLocked: true,
        lockedAt: new Date()
      }
    })

    // Create invoice line items
    await db.invoiceLineItem.create({
      data: {
        invoiceId: invoice.id,
        description: 'Cash Collected',
        quantity: deliveredOrders,
        unitPrice: 0,
        amount: cashCollected,
        category: 'ORDER'
      }
    })

    await db.invoiceLineItem.create({
      data: {
        invoiceId: invoice.id,
        description: 'Delivery Fees',
        quantity: deliveredOrders,
        unitPrice: costPerDelivery,
        amount: -deliveryFees,
        category: 'FEE'
      }
    })

    // Link invoice to remittance lock
    await db.remittanceLock.update({
      where: { id: remittanceLock.id },
      data: { invoiceId: invoice.id }
    })

    await logActivity(user.id, user.role, 'REMITTANCE_LOCKED', `Locked remittance for ${deliveryMan.name}: ${cashCollected} XAF`)

    return NextResponse.json({ invoice, remittanceLock, message: 'Remittance locked successfully' })
  } catch (error) {
    console.error('Lock remittance error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to lock remittance' }, { status: 500 })
  }
}
