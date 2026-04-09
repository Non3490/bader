import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getPriorityQueue } from '@/lib/agent-assign'
import { db } from '@/lib/db'

interface QueuedOrder {
  id: string
  trackingNumber: string
  customerName: string
  customerPhone: string
  customerAddress: string
  city: string
  productName: string
  productDescription?: string
  quantity: number
  codAmount: number
  status: string
  notes: string | null
  createdAt: string
  scheduledCallAt: string | null
  isBundle: boolean
  bundleGroupId: string | null
  itemNames: string[]
  itemCount: number
  sellerName?: string
  isBlacklisted: boolean
  isPriority: boolean
  callLogs: Array<{
    id: string
    attempt: string
    createdAt: string
  }>
}

// GET /api/orders/queue - Priority-sorted queue for call center
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Only call center agents and admins can access priority queue
    if (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Call center only' }, { status: 403 })
    }

    // Unified Agent View: CALL_CENTER agents see ALL sellers' orders (no parentSellerId filter)
    const scoredQueue = await getPriorityQueue(null)
    const orderIds = scoredQueue.map(q => q.orderId)

    if (orderIds.length === 0) {
      return NextResponse.json({ orders: [] })
    }

    // Fetch full order details
    const orders = await db.order.findMany({
      where: { id: { in: orderIds } },
      include: {
        seller: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, name: true } } }
        },
        callLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    })

    // Bundle detection: same phone + 2+ sellers + same day
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Group orders by phone for bundle detection
    const phoneGroups = new Map<string, typeof orders>()
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt)
      const orderDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate())

      // Only group orders from same day
      if (orderDay.getTime() === today.getTime()) {
        const existing = phoneGroups.get(order.phone) || []
        existing.push(order)
        phoneGroups.set(order.phone, existing)
      }
    })

    // Determine which orders are bundles (same phone, 2+ sellers, same day)
    const bundleOrderIds = new Set<string>()
    for (const [phone, groupOrders] of phoneGroups) {
      const uniqueSellers = new Set(groupOrders.map(o => o.sellerId))
      if (uniqueSellers.size >= 2) {
        // This phone has orders from 2+ sellers today - mark all as bundle
        groupOrders.forEach(o => bundleOrderIds.add(o.id))
      }
    }

    // Build order list with bundle detection
    const queuedOrders: QueuedOrder[] = orderIds.map(orderId => {
      const order = orders.find(o => o.id === orderId)!
      const scoreEntry = scoredQueue.find(q => q.orderId === orderId)!

      // Bundle detection: same phone + 2+ sellers + same day
      const isBundle = bundleOrderIds.has(order.id)

      // Build item names for display
      const itemNames = order.items.map(item => {
        const name = item.product.name
        const qty = item.quantity > 1 ? ` (x${item.quantity})` : ''
        return name + qty
      })

      // Primary product name (for backward compatibility)
      const primaryItem = order.items[0]
      const totalQuantity = order.items.reduce((sum, i) => sum + i.quantity, 0)

      return {
        id: order.id,
        trackingNumber: order.trackingNumber,
        customerName: order.recipientName,
        customerPhone: order.phone,
        customerAddress: order.address,
        city: order.city,
        productName: primaryItem.product.name,
        productDescription: undefined,
        quantity: totalQuantity,
        codAmount: order.codAmount,
        status: order.status,
        notes: order.note,
        createdAt: order.createdAt.toISOString(),
        scheduledCallAt: order.scheduledCallAt?.toISOString() ?? null,
        isBundle,
        bundleGroupId: order.bundleGroupId,
        itemNames,
        itemCount: order.items.length,
        sellerName: order.seller?.name,
        isBlacklisted: scoreEntry.isBlacklisted ?? false,
        isPriority: scoreEntry.isPriority ?? false,
        callLogs: order.callLogs.map(log => ({
          id: log.id,
          attempt: log.attempt,
          createdAt: log.createdAt.toISOString()
        }))
      }
    })

    // Calculate daily stats for the KPI bar
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [totalCalls, confirmed, cancelled] = await Promise.all([
      db.callLog.count({
        where: {
          ...(user.role === 'CALL_CENTER' ? { agentId: user.id } : {}),
          createdAt: { gte: todayStart }
        }
      }),
      db.order.count({
        where: {
          status: 'CONFIRMED',
          updatedAt: { gte: todayStart },
          ...(user.role === 'CALL_CENTER' ? { assignedAgentId: user.id } : {})
        }
      }),
      db.order.count({
        where: {
          status: 'CANCELLED',
          updatedAt: { gte: todayStart },
          ...(user.role === 'CALL_CENTER' ? { assignedAgentId: user.id } : {})
        }
      })
    ])

    return NextResponse.json({
      orders: queuedOrders,
      stats: { totalCalls, confirmed, cancelled }
    })
  } catch (error) {
    console.error('Priority queue error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
