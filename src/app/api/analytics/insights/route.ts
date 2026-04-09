import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const sellerFilter = user.role === 'ADMIN' ? {} : { sellerId: user.id }
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [orders30d, orders7d, cityGroups] = await Promise.all([
      db.order.findMany({
        where: { ...sellerFilter, createdAt: { gte: thirtyDaysAgo } },
        select: { status: true, codAmount: true, city: true, createdAt: true }
      }),
      db.order.findMany({
        where: { ...sellerFilter, createdAt: { gte: sevenDaysAgo } },
        select: { status: true, codAmount: true, createdAt: true }
      }),
      db.order.groupBy({
        by: ['city'],
        where: { ...sellerFilter, createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
        _sum: { codAmount: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      })
    ])

    const delivered30d = orders30d.filter(o => o.status === 'DELIVERED')
    const confirmed30d = orders30d.filter(o => o.status === 'CONFIRMED')
    const returned30d = orders30d.filter(o => o.status === 'RETURNED')
    const totalRevenue30d = delivered30d.reduce((s, o) => s + o.codAmount, 0)

    const deliveryRate = orders30d.length > 0
      ? Math.round((delivered30d.length / orders30d.length) * 100)
      : 0
    const returnRate = orders30d.length > 0
      ? Math.round((returned30d.length / orders30d.length) * 100)
      : 0
    const confirmationRate = orders30d.length > 0
      ? Math.round((confirmed30d.length / orders30d.length) * 100)
      : 0

    // Daily breakdown for last 7 days
    const dailyMap: Record<string, { orders: number; delivered: number; revenue: number }> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      dailyMap[key] = { orders: 0, delivered: 0, revenue: 0 }
    }
    for (const o of orders7d) {
      const key = o.createdAt.toISOString().split('T')[0]
      if (dailyMap[key]) {
        dailyMap[key].orders++
        if (o.status === 'DELIVERED') {
          dailyMap[key].delivered++
          dailyMap[key].revenue += o.codAmount
        }
      }
    }

    const cityPerformance = cityGroups.map(c => ({
      city: c.city,
      orders: c._count.id,
      revenue: c._sum.codAmount ?? 0
    }))

    return NextResponse.json({
      period: '30d',
      summary: {
        totalOrders: orders30d.length,
        delivered: delivered30d.length,
        confirmed: confirmed30d.length,
        returned: returned30d.length,
        totalRevenue: totalRevenue30d,
        deliveryRate,
        returnRate,
        confirmationRate,
        avgOrderValue: delivered30d.length > 0 ? totalRevenue30d / delivered30d.length : 0,
        avgDailyOrders: Math.round(orders30d.length / 30)
      },
      daily: Object.entries(dailyMap).map(([date, v]) => ({ date, ...v })),
      cityPerformance
    })
  } catch (error) {
    console.error('Insights error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
