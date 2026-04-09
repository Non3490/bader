import { NextResponse } from 'next/server'
import { startOfDay, endOfDay } from 'date-fns'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getAgentStats } from '@/lib/agent-stats'
import { sortQueueByPriority } from '@/lib/queue-priority'

const DAILY_TARGET = 56

export async function GET() {
  try {
    const user = await getSession()
    if (!user || user.role !== 'CALL_CENTER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const now = new Date()
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)

    const [stats, queueOrders, callbacks] = await Promise.all([
      getAgentStats(user.id, todayStart, todayEnd),
      db.order.findMany({
        where: {
          assignedAgentId: user.id,
          status: { in: ['NEW', 'NO_ANSWER', 'BUSY', 'CALLBACK', 'POSTPONED'] }
        },
        include: {
          seller: { select: { name: true } },
          items: { include: { product: { select: { name: true } } } }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ]
      }),
      db.order.findMany({
        where: {
          assignedAgentId: user.id,
          scheduledCallAt: { gte: todayStart, lte: todayEnd }
        },
        include: {
          seller: { select: { name: true } }
        },
        orderBy: { scheduledCallAt: 'asc' }
      })
    ])

    const phones = Array.from(new Set(queueOrders.map((order) => order.phone)))
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
    const blacklistSet = new Set(blacklists.map((item) => item.phone))

    const priorityOrders = sortQueueByPriority(queueOrders.map((order) => ({
      id: order.id,
      recipientName: order.recipientName,
      sellerName: order.seller?.name || 'Unknown seller',
      codAmount: order.codAmount,
      trackingNumber: order.trackingNumber,
      scheduledCallAt: order.scheduledCallAt ? new Date(order.scheduledCallAt) : null,
      createdAt: new Date(order.createdAt),
      customerDeliveryRate: customerRateMap.get(order.phone) ?? 0,
      itemCount: order.items.length,
      status: order.status,
      phone: order.phone,
      isBlacklisted: blacklistSet.has(order.phone),
      bundleGroupId: order.bundleGroupId
    }))).filter((order) => order.isPriority)

    return NextResponse.json({
      kpis: {
        callsMade: stats.totalCalls,
        dailyTarget: DAILY_TARGET,
        confirmed: stats.confirmed,
        cancelled: stats.cancelled,
        confirmRate: stats.confirmRate
      },
      priorityQueue: {
        count: priorityOrders.length,
        items: priorityOrders.slice(0, 3).map((order) => ({
          id: order.id,
          customerName: order.recipientName,
          sellerName: order.sellerName,
          amount: order.codAmount,
          trackingNumber: order.trackingNumber
        }))
      },
      callbacks: callbacks.map((order) => ({
        id: order.id,
        customerName: order.recipientName,
        phone: order.phone,
        scheduledCallAt: order.scheduledCallAt ? new Date(order.scheduledCallAt).toISOString() : null,
        sellerName: order.seller?.name || 'Unknown seller'
      }))
    })
  } catch (error) {
    console.error('Agent dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
