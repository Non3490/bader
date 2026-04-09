import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { sortQueueByPriority } from '@/lib/queue-priority'

export async function GET() {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const where = {
      ...(user.role === 'CALL_CENTER' ? { assignedAgentId: user.id } : {}),
      status: { in: ['NEW', 'NO_ANSWER', 'BUSY', 'CALLBACK', 'POSTPONED'] },
      OR: [
        { scheduledCallAt: null },
        { scheduledCallAt: { lte: now } }
      ]
    }

    const orders = await db.order.findMany({
      where,
      include: {
        seller: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { name: true } }
          }
        },
        callLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    const phones = Array.from(new Set(orders.map((order) => order.phone)))
    const [customers, blacklists] = await Promise.all([
      db.customer.findMany({
        where: { phone: { in: phones } },
        select: { phone: true, deliveryRate: true }
      }),
      db.blacklist.findMany({
        where: { phone: { in: phones }, isActive: true },
        select: { phone: true }
      })
    ])

    const customerRateMap = new Map(customers.map((customer) => [customer.phone, customer.deliveryRate]))
    const blacklistSet = new Set(blacklists.map((entry) => entry.phone))

    const scored = sortQueueByPriority(
      orders.map((order) => {
        const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0)
        return {
          id: order.id,
          trackingNumber: order.trackingNumber,
          customerName: order.recipientName,
          customerPhone: order.phone,
          customerAddress: order.address,
          city: order.city,
          productName: order.items[0]?.product?.name || 'Unknown product',
          quantity,
          codAmount: order.codAmount,
          status: order.status,
          notes: order.note,
          createdAt: new Date(order.createdAt),
          scheduledCallAt: order.scheduledCallAt ? new Date(order.scheduledCallAt) : null,
          sellerName: order.seller?.name || 'Unknown seller',
          itemNames: order.items.map((item) => item.quantity > 1 ? `${item.product.name} (x${item.quantity})` : item.product.name),
          itemCount: order.items.length,
          bundleGroupId: order.bundleGroupId,
          isBundle: Boolean(order.bundleGroupId),
          isBlacklisted: blacklistSet.has(order.phone),
          customerDeliveryRate: customerRateMap.get(order.phone) ?? 0,
          phone: order.phone,
          callLogs: order.callLogs
        }
      }),
      now
    )

    const formatted = scored.map((order) => {
      const callLogs = Array.isArray(order.callLogs) ? order.callLogs : []

      return {
        id: order.id,
        trackingNumber: order.trackingNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        city: order.city,
        productName: order.productName,
        quantity: order.quantity,
        codAmount: order.codAmount,
        status: order.status,
        notes: order.notes,
        createdAt: new Date(order.createdAt).toISOString(),
        scheduledCallAt: order.scheduledCallAt ? new Date(order.scheduledCallAt).toISOString() : null,
        sellerName: order.sellerName,
        itemNames: order.itemNames,
        itemCount: order.itemCount,
        bundleGroupId: order.bundleGroupId,
        isBundle: order.isBundle,
        isBlacklisted: order.isBlacklisted,
        isPriority: order.isPriority,
        _score: order.score,
        callLogs: callLogs.map((log) => ({
          id: log.id,
          attempt: log.attempt,
          createdAt: new Date(log.createdAt).toISOString()
        }))
      }
    })

    return NextResponse.json({ orders: formatted, priorityThreshold: 5000 })
  } catch (error) {
    console.error('Priority queue route error:', error)
    return NextResponse.json({ error: 'Failed to fetch priority queue' }, { status: 500 })
  }
}
