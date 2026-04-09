import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { scopeByRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

// GET /api/finance/daily
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

    const orders = await db.order.findMany({
      where: {
        ...scopeByRole(user.id, user.role, user.parentSellerId),
        status: 'DELIVERED',
        deliveredAt: { gte: startDate, lte: endDate }
      },
      select: {
        codAmount: true,
        productCost: true,
        shippingCost: true,
        callCenterFee: true,
        platformFee: true,
        adSpend: true,
        deliveredAt: true
      }
    })

    const dailyData: Record<string, { revenue: number; costs: number; orders: number }> = {}

    for (const order of orders) {
      if (!order.deliveredAt) continue
      const date = order.deliveredAt.toISOString().split('T')[0]
      if (!dailyData[date]) dailyData[date] = { revenue: 0, costs: 0, orders: 0 }
      const costs = order.productCost + order.shippingCost + order.callCenterFee + order.platformFee + order.adSpend
      dailyData[date].revenue += order.codAmount
      dailyData[date].costs += costs
      dailyData[date].orders++
    }

    const daily = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        costs: data.costs,
        profit: data.revenue - data.costs,
        orders: data.orders
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ daily })
  } catch (error) {
    console.error('Finance daily error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
