import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

interface DashboardMetrics {
  // Today's metrics
  today: {
    totalOrders: number
    totalRevenue: number
    averageOrderValue: number
  }
  // This week's metrics
  thisWeek: {
    totalOrders: number
    totalRevenue: number
    averageOrderValue: number
    percentChange: {
      orders: number
      revenue: number
      avgOrderValue: number
    }
  }
  // This month's metrics
  thisMonth: {
    totalOrders: number
    totalRevenue: number
    averageOrderValue: number
    percentChange: {
      orders: number
      revenue: number
      avgOrderValue: number
    }
  }
  // Order statistics
  orderStats: {
    pending: number
    confirmed: number
    shipped: number
    delivered: number
    returned: number
    cancelled: number
    postponed: number
    noAnswer: number
    busy: number
    callback: number
    unreached: number
    wrongNumber: number
    double: number
    returnToStock: number
  }
  // Top selling items
  topSellingItems: Array<{
    productId: string
    productName: string
    quantitySold: number
    totalRevenue: number
  }>
  // Revenue chart data (last 30 days)
  revenueChart: Array<{
    date: string
    revenue: number
  }>
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and super admins can view reports
    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Helper to build date range where clause
    const getWhereClause = (startDate: Date, endDate: Date) => {
      const where: Record<string, unknown> = {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
      return where
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    const twoMonthsAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000)

    // TODAY - only count completed orders
    const todayOrders = await db.order.findMany({
      where: {
        ...getWhereClause(today, now),
        status: 'DELIVERED' // Only count completed orders
      }
    })

    const todayTotal = todayOrders.length
    const todayRevenue = todayOrders.reduce((sum, order) => sum + order.codAmount, 0)
    const todayAvgOrder = todayTotal > 0 ? todayRevenue / todayTotal : 0

    // THIS WEEK
    const thisWeekOrders = await db.order.findMany({
      where: {
        ...getWhereClause(weekAgo, now),
        status: 'DELIVERED'
      }
    })

    const lastWeekOrders = await db.order.findMany({
      where: {
        ...getWhereClause(twoWeeksAgo, weekAgo),
        status: 'DELIVERED'
      }
    })

    const thisWeekTotal = thisWeekOrders.length
    const thisWeekRevenue = thisWeekOrders.reduce((sum, order) => sum + order.codAmount, 0)
    const thisWeekAvgOrder = thisWeekTotal > 0 ? thisWeekRevenue / thisWeekTotal : 0

    const lastWeekTotal = lastWeekOrders.length
    const lastWeekRevenue = lastWeekOrders.reduce((sum, order) => sum + order.codAmount, 0)
    const lastWeekAvgOrder = lastWeekTotal > 0 ? lastWeekRevenue / lastWeekTotal : 0

    const weekPercentChange = {
      orders: lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 : 0,
      revenue: lastWeekRevenue > 0 ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0,
      avgOrderValue: lastWeekAvgOrder > 0 ? ((thisWeekAvgOrder - lastWeekAvgOrder) / lastWeekAvgOrder) * 100 : 0
    }

    // THIS MONTH
    const thisMonthOrders = await db.order.findMany({
      where: {
        ...getWhereClause(monthAgo, now),
        status: 'DELIVERED'
      }
    })

    const lastMonthOrders = await db.order.findMany({
      where: {
        ...getWhereClause(twoMonthsAgo, monthAgo),
        status: 'DELIVERED'
      }
    })

    const thisMonthTotal = thisMonthOrders.length
    const thisMonthRevenue = thisMonthOrders.reduce((sum, order) => sum + order.codAmount, 0)
    const thisMonthAvgOrder = thisMonthTotal > 0 ? thisMonthRevenue / thisMonthTotal : 0

    const lastMonthTotal = lastMonthOrders.length
    const lastMonthRevenue = lastMonthOrders.reduce((sum, order) => sum + order.codAmount, 0)
    const lastMonthAvgOrder = lastMonthTotal > 0 ? lastMonthRevenue / lastMonthTotal : 0

    const monthPercentChange = {
      orders: lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0,
      revenue: lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0,
      avgOrderValue: lastMonthAvgOrder > 0 ? ((thisMonthAvgOrder - lastMonthAvgOrder) / lastMonthAvgOrder) * 100 : 0
    }

    // ORDER STATISTICS (all orders, not just completed)
    const allOrders = await db.order.findMany({
      where: getWhereClause(monthAgo, now)
    })

    const orderStats = {
      pending: allOrders.filter(o => o.status === 'NEW' || o.status === 'PENDING').length,
      confirmed: allOrders.filter(o => o.status === 'CONFIRMED').length,
      shipped: allOrders.filter(o => o.status === 'SHIPPED').length,
      delivered: allOrders.filter(o => o.status === 'DELIVERED').length,
      returned: allOrders.filter(o => o.status === 'RETURNED').length,
      cancelled: allOrders.filter(o => o.status === 'CANCELLED').length,
      postponed: allOrders.filter(o => o.status === 'POSTPONED').length,
      noAnswer: allOrders.filter(o => o.status === 'NO_ANSWER').length,
      busy: allOrders.filter(o => o.status === 'BUSY').length,
      callback: allOrders.filter(o => o.status === 'CALLBACK').length,
      unreached: allOrders.filter(o => o.status === 'UNREACHED').length,
      wrongNumber: allOrders.filter(o => o.status === 'WRONG_NUMBER').length,
      double: allOrders.filter(o => o.status === 'DOUBLE').length,
      returnToStock: allOrders.filter(o => o.status === 'RETURN_TO_STOCK').length
    }

    // TOP SELLING ITEMS (by quantity)
    const orderItems = await db.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: monthAgo },
          status: 'DELIVERED'
        }
      },
      include: {
        product: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    const productSales = new Map<string, { name: string; quantity: number; revenue: number }>()

    for (const item of orderItems) {
      const existing = productSales.get(item.productId)
      if (existing) {
        existing.quantity += item.quantity
        existing.revenue += item.unitPrice * item.quantity
      } else {
        productSales.set(item.productId, {
          name: item.product.name,
          quantity: item.quantity,
          revenue: item.unitPrice * item.quantity
        })
      }
    }

    const topSellingItems = Array.from(productSales.entries())
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        quantitySold: data.quantity,
        totalRevenue: data.revenue
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5)

    // REVENUE CHART (last 30 days, daily)
    const revenueChart: Array<{ date: string; revenue: number }> = []

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const dayOrders = await db.order.findMany({
        where: {
          ...getWhereClause(date, nextDate),
          status: 'DELIVERED'
        }
      })

      const dayRevenue = dayOrders.reduce((sum, order) => sum + order.codAmount, 0)

      revenueChart.push({
        date: date.toISOString().split('T')[0],
        revenue: dayRevenue
      })
    }

    const metrics: DashboardMetrics = {
      today: {
        totalOrders: todayTotal,
        totalRevenue: todayRevenue,
        averageOrderValue: todayAvgOrder
      },
      thisWeek: {
        totalOrders: thisWeekTotal,
        totalRevenue: thisWeekRevenue,
        averageOrderValue: thisWeekAvgOrder,
        percentChange: weekPercentChange
      },
      thisMonth: {
        totalOrders: thisMonthTotal,
        totalRevenue: thisMonthRevenue,
        averageOrderValue: thisMonthAvgOrder,
        percentChange: monthPercentChange
      },
      orderStats,
      topSellingItems,
      revenueChart
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Dashboard metrics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
