import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * KPI Endpoint for Analytics Dashboard
 * GET /api/analytics/kpi
 *
 * Returns KPI cards data with period and comparison support
 * Spec requirement: 6.1 — Admin KPI Dashboard
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN' && session.role !== 'SELLER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '30d'
    const sellerId = searchParams.get('sellerId')
    const city = searchParams.get('city')
    const dateFromParam = searchParams.get('dateFrom')
    const dateToParam = searchParams.get('dateTo')
    const compare = searchParams.get('compare') === 'true'

    // Calculate date range
    let dateFrom: Date
    let dateTo: Date | undefined

    if (period === 'custom' && dateFromParam && dateToParam) {
      dateFrom = new Date(dateFromParam)
      dateTo = new Date(dateToParam)
    } else {
      const days = period === 'today' ? 1 : period === '7d' ? 7 : period === '90d' ? 90 : 30
      dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }

    // Build base where clause
    const baseWhere: any = { createdAt: { gte: dateFrom } }
    if (dateTo) {
      baseWhere.createdAt.lte = dateTo
    }

    // Apply seller filter (sellers only see their own data)
    if (session.role === 'SELLER') {
      baseWhere.sellerId = session.user.id
    } else if (sellerId && sellerId !== 'all') {
      baseWhere.sellerId = sellerId
    }

    // Apply city filter
    if (city && city !== 'all') {
      baseWhere.city = city
    }

    // Build delivered orders where clause
    const deliveredWhere: any = { status: 'DELIVERED' }
    if (dateTo) {
      deliveredWhere.deliveredAt = { gte: dateFrom, lte: dateTo }
    } else {
      deliveredWhere.deliveredAt = { gte: dateFrom }
    }
    if (session.role === 'SELLER') {
      deliveredWhere.sellerId = session.user.id
    } else if (sellerId && sellerId !== 'all') {
      deliveredWhere.sellerId = sellerId
    }

    // Fetch current period KPIs
    const [
      totalOrders,
      deliveredOrders,
      revenueResult
    ] = await Promise.all([
      db.order.count({ where: baseWhere }),
      db.order.count({ where: { ...baseWhere, status: 'DELIVERED' } }),
      db.order.aggregate({
        _sum: { codAmount: true },
        where: deliveredWhere
      })
    ])

    const totalRevenue = revenueResult._sum.codAmount ?? 0
    const netProfit = Math.round(totalRevenue * 0.6) // 60% profit margin
    const deliveryRate = totalOrders > 0 ? parseFloat(((deliveredOrders / totalOrders) * 100).toFixed(1)) : 0

    // Fetch previous period data if comparison is enabled
    let previousPeriod: {
      totalOrders: number
      totalRevenue: number
      netProfit: number
      deliveryRate: number
      dateFrom: string
      dateTo: string
    } | null = null

    if (compare) {
      let previousStart: Date
      let previousEnd: Date

      if (period === 'custom' && dateFrom && dateTo) {
        const daysDiff = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24))
        previousStart = new Date(dateFrom)
        previousStart.setDate(previousStart.getDate() - daysDiff)
        previousEnd = new Date(dateTo)
        previousEnd.setDate(previousEnd.getDate() - daysDiff)
      } else {
        const days = period === 'today' ? 1 : period === '7d' ? 7 : period === '90d' ? 90 : 30
        const now = new Date()
        const periodStart = new Date(now)
        periodStart.setDate(now.getDate() - days)
        previousEnd = new Date(periodStart)
        previousStart = new Date(periodStart)
        previousStart.setDate(previousStart.getDate() - days)
      }

      const prevBaseWhere: any = {
        createdAt: { gte: previousStart, lte: previousEnd }
      }
      const prevDeliveredWhere: any = {
        status: 'DELIVERED',
        deliveredAt: { gte: previousStart, lte: previousEnd }
      }

      if (session.role === 'SELLER') {
        prevBaseWhere.sellerId = session.user.id
        prevDeliveredWhere.sellerId = session.user.id
      } else if (sellerId && sellerId !== 'all') {
        prevBaseWhere.sellerId = sellerId
        prevDeliveredWhere.sellerId = sellerId
      }
      if (city && city !== 'all') {
        prevBaseWhere.city = city
        prevDeliveredWhere.city = city
      }

      const [prevTotalOrders, prevDeliveredOrders, prevRevenueResult] = await Promise.all([
        db.order.count({ where: prevBaseWhere }),
        db.order.count({ where: { ...prevBaseWhere, status: 'DELIVERED' } }),
        db.order.aggregate({
          _sum: { codAmount: true },
          where: prevDeliveredWhere
        })
      ])

      const prevTotalRevenue = prevRevenueResult._sum.codAmount ?? 0
      previousPeriod = {
        totalOrders: prevTotalOrders,
        totalRevenue: prevTotalRevenue,
        netProfit: Math.round(prevTotalRevenue * 0.6),
        deliveryRate: prevTotalOrders > 0 ? parseFloat(((prevDeliveredOrders / prevTotalOrders) * 100).toFixed(1)) : 0,
        dateFrom: previousStart.toISOString(),
        dateTo: previousEnd.toISOString()
      }
    }

    return NextResponse.json({
      period,
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo ? dateTo.toISOString() : new Date().toISOString(),
      current: {
        totalOrders,
        totalRevenue,
        netProfit,
        deliveryRate
      },
      previous: previousPeriod,
      // Calculated trends
      trends: previousPeriod ? {
        totalOrders: calculateTrend(totalOrders, previousPeriod.totalOrders),
        totalRevenue: calculateTrend(totalRevenue, previousPeriod.totalRevenue),
        netProfit: calculateTrend(netProfit, previousPeriod.netProfit),
        deliveryRate: calculateTrend(deliveryRate, previousPeriod.deliveryRate)
      } : null
    })
  } catch (error) {
    console.error('KPI API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function calculateTrend(current: number, previous: number): { value: number; label: string; positive: boolean } {
  if (!previous || previous === 0) {
    return { value: 0, label: 'N/A', positive: true }
  }
  const change = ((current - previous) / previous) * 100
  return {
    value: Math.abs(change),
    label: `${Math.abs(change).toFixed(1)}%`,
    positive: change >= 0
  }
}
