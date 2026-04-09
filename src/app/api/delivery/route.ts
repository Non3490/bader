import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/delivery - Delivery agent's assigned orders
export async function GET() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const deliveryScope = user.role === 'ADMIN' ? {} : { deliveryManId: user.id }

    // Active: SHIPPED + POSTPONED (still need delivery)
    const activeOrders = await db.order.findMany({
      where: { ...deliveryScope, status: { in: ['SHIPPED', 'POSTPONED'] } },
      include: {
        seller: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } }
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      take: 200
    })

    // Today's completed (DELIVERED + RETURNED today only)
    const completedToday = await db.order.findMany({
      where: {
        ...deliveryScope,
        OR: [
          { status: 'DELIVERED', deliveredAt: { gte: today } },
          { status: 'RETURNED', returnedAt: { gte: today } }
        ]
      },
      include: {
        seller: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 100
    })

    const orders = [...activeOrders, ...completedToday]

    const [deliveredToday, returnedToday, cashCollected] = await Promise.all([
      db.order.count({
        where: { ...deliveryScope, status: 'DELIVERED', deliveredAt: { gte: today } }
      }),
      db.order.count({
        where: { ...deliveryScope, status: 'RETURNED', returnedAt: { gte: today } }
      }),
      db.order.aggregate({
        where: { ...deliveryScope, status: 'DELIVERED', deliveredAt: { gte: today } },
        _sum: { codAmount: true }
      })
    ])

    return NextResponse.json({
      orders: orders.map(o => ({
        id: o.id,
        trackingNumber: o.trackingNumber,
        recipientName: o.recipientName,
        phone: o.phone,
        address: o.address,
        city: o.city,
        codAmount: o.codAmount,
        status: o.status,
        note: o.note,
        createdAt: o.createdAt.toISOString(),
        seller: o.seller,
        items: o.items.map(i => ({
          productName: i.product.name,
          productSku: i.product.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice
        }))
      })),
      stats: {
        assigned: activeOrders.length,
        delivered: deliveredToday,
        returned: returnedToday,
        cashCollected: cashCollected._sum.codAmount ?? 0
      }
    })
  } catch (error) {
    console.error('Delivery GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
