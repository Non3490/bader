import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { scopeByRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

// GET /api/finance/stats
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const period = request.nextUrl.searchParams.get('period') || '7d'
    const now = new Date()
    let startDate = new Date()
    let endDate = now

    // Handle custom date range
    const customStart = request.nextUrl.searchParams.get('startDate')
    const customEnd = request.nextUrl.searchParams.get('endDate')
    if (customStart && customEnd && period === 'custom') {
      startDate = new Date(customStart)
      endDate = new Date(customEnd)
    } else if (period === '30d') {
      startDate.setDate(now.getDate() - 30)
    } else if (period === '90d') {
      startDate.setDate(now.getDate() - 90)
    } else if (period === 'today') {
      startDate = new Date(now.setHours(0, 0, 0, 0))
    } else {
      startDate.setDate(now.getDate() - 7)
    }

    const roleScope = scopeByRole(user.id, user.role, user.parentSellerId)

    const deliveredOrders = await db.order.findMany({
      where: {
        ...roleScope,
        status: 'DELIVERED',
        deliveredAt: { gte: startDate }
      },
      select: { codAmount: true, productCost: true, shippingCost: true, callCenterFee: true, platformFee: true, adSpend: true }
    })

    const totalRevenue = deliveredOrders.reduce((s, o) => s + o.codAmount, 0)
    const totalProductCost = deliveredOrders.reduce((s, o) => s + o.productCost, 0)
    const totalShippingCost = deliveredOrders.reduce((s, o) => s + o.shippingCost, 0)
    const totalCallCenterFee = deliveredOrders.reduce((s, o) => s + o.callCenterFee, 0)
    const totalPlatformFee = deliveredOrders.reduce((s, o) => s + o.platformFee, 0)
    const totalAdSpend = deliveredOrders.reduce((s, o) => s + o.adSpend, 0)
    const totalCosts = totalProductCost + totalShippingCost + totalCallCenterFee + totalPlatformFee + totalAdSpend
    const totalProfit = totalRevenue - totalCosts

    const [totalOrders, returnedCount, pendingCOD, collectedCOD] = await Promise.all([
      db.order.count({ where: { ...roleScope, createdAt: { gte: startDate } } }),
      db.order.count({ where: { ...roleScope, status: 'RETURNED', returnedAt: { gte: startDate } } }),
      db.order.aggregate({
        where: { ...roleScope, status: { in: ['NEW', 'CONFIRMED', 'SHIPPED'] } },
        _sum: { codAmount: true }
      }),
      db.order.aggregate({
        where: { ...roleScope, status: 'DELIVERED', deliveredAt: { gte: startDate } },
        _sum: { codAmount: true }
      })
    ])

    const deliveredCount = deliveredOrders.length
    const deliveryRate = totalOrders > 0
      ? Math.round((deliveredCount / totalOrders) * 100)
      : 0

    return NextResponse.json({
      totalRevenue,
      totalCosts,
      totalProfit,
      deliveryRate,
      ordersCount: totalOrders,
      deliveredCount,
      returnedCount,
      pendingCOD: pendingCOD._sum.codAmount ?? 0,
      collectedCOD: collectedCOD._sum.codAmount ?? 0,
      costsBreakdown: {
        product: totalProductCost,
        shipping: totalShippingCost,
        callCenter: totalCallCenterFee,
        platform: totalPlatformFee,
        adSpend: totalAdSpend
      }
    })
  } catch (error) {
    console.error('Finance stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
