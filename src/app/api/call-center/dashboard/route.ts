import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/call-center/dashboard - Get active phone orders stats
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const twoHoursAgo = new Date()
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)

    // Get active phone orders (created in last 2 hours with source: PHONE)
    const activePhoneOrders = await db.order.findMany({
      where: {
        source: 'PHONE',
        createdAt: { gte: twoHoursAgo }
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Count pending phone orders (not yet confirmed)
    const pendingCount = activePhoneOrders.filter(
      o => o.status === 'NEW' || o.status === 'CONFIRMED'
    ).length

    // Get today's call stats for current agent
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayCalls = await db.phoneCallLog.count({
      where: {
        agentId: user.id,
        createdAt: { gte: today }
      }
    })

    const todayCallbacks = await db.phoneCallLog.count({
      where: {
        agentId: user.id,
        callbackNeeded: true,
        callbackDone: false,
        createdAt: { gte: today }
      }
    })

    // Get overdue callbacks
    const overdueCallbacks = await db.phoneCallLog.count({
      where: {
        agentId: user.id,
        callbackNeeded: true,
        callbackDone: false,
        callbackAt: { lte: new Date() }
      }
    })

    return NextResponse.json({
      stats: {
        activePhoneOrders: activePhoneOrders.length,
        pendingPhoneOrders: pendingCount,
        todayCalls,
        pendingCallbacks: todayCallbacks,
        overdueCallbacks
      },
      activeOrders: activePhoneOrders.map(order => ({
        id: order.id,
        trackingNumber: order.trackingNumber,
        recipientName: order.recipientName,
        phone: order.phone,
        address: order.address,
        city: order.city,
        codAmount: order.codAmount,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        itemCount: order.items.length,
        itemNames: order.items.map(i => i.product.name).join(', ')
      }))
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
