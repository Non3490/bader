import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminSession, checkPermission } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const permissionCheck = checkPermission(session.role as any, 'reports:view_all')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today' // today | week | month
    const sellerId = searchParams.get('sellerId')

    // Helper function to get date range based on period
    const getDateRange = (period: string) => {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      switch (period) {
        case 'today':
          return { start: today, end: now }
        case 'week':
          const weekAgo = new Date(today)
          weekAgo.setDate(weekAgo.getDate() - 7)
          return { start: weekAgo, end: now }
        case 'month':
          const monthAgo = new Date(today)
          monthAgo.setDate(monthAgo.getDate() - 30)
          return { start: monthAgo, end: now }
        default:
          return { start: today, end: now }
      }
    }

    const { start: currentStart, end: currentEnd } = getDateRange(period)

    // Previous period for comparison
    const periodLength = currentEnd.getTime() - currentStart.getTime()
    const previousStart = new Date(currentStart.getTime() - periodLength)
    const previousEnd = new Date(currentEnd.getTime() - periodLength)

    // Build where clause
    const buildWhereClause = (start: Date, end: Date) => {
      const where: Record<string, unknown> = {
        createdAt: {
          gte: start,
          lte: end
        }
      }

      // If sellerId is provided, scope to that seller's orders
      if (sellerId) {
        where.sellerId = sellerId
      }

      return where
    }

    const currentWhere = buildWhereClause(currentStart, currentEnd)
    const previousWhere = buildWhereClause(previousStart, previousEnd)

    // Get all orders for current and previous periods
    const currentOrders = await db.order.findMany({
      where: currentWhere,
      select: {
        id: true,
        trackingNumber: true,
        recipientName: true,
        phone: true,
        city: true,
        status: true,
        codAmount: true,
        source: true,
        createdAt: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            unitPrice: true,
            product: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    const previousOrders = await db.order.findMany({
      where: previousWhere
    })

    // Calculate KPIs
    const totalOrders = currentOrders.length
    const confirmedOrders = currentOrders.filter(o => ['CONFIRMED', 'SHIPPED', 'DELIVERED'].includes(o.status)).length
    const deliveredOrders = currentOrders.filter(o => o.status === 'DELIVERED').length
    const cancelledOrders = currentOrders.filter(o => o.status === 'CANCELLED').length
    const pendingOrders = currentOrders.filter(o => o.status === 'NEW').length

    // Revenue ONLY from DELIVERED orders
    const totalRevenue = currentOrders
      .filter(o => o.status === 'DELIVERED')
      .reduce((sum, o) => sum + o.codAmount, 0)

    const averageOrderValue = deliveredOrders > 0 ? totalRevenue / deliveredOrders : 0

    const deliveryRate = (deliveredOrders + cancelledOrders + currentOrders.filter(o => o.status === 'RETURNED').length) > 0
      ? (deliveredOrders / (deliveredOrders + cancelledOrders + currentOrders.filter(o => o.status === 'RETURNED').length)) * 100
      : 0

    // Previous period KPIs for comparison
    const prevTotalOrders = previousOrders.length
    const prevDeliveredOrders = previousOrders.filter(o => o.status === 'DELIVERED').length
    const prevTotalRevenue = previousOrders
      .filter(o => o.status === 'DELIVERED')
      .reduce((sum, o) => sum + o.codAmount, 0)
    const prevDeliveryRate = (prevDeliveredOrders +
      previousOrders.filter(o => o.status === 'CANCELLED').length +
      previousOrders.filter(o => o.status === 'RETURNED').length) > 0
      ? (prevDeliveredOrders / (prevDeliveredOrders +
          previousOrders.filter(o => o.status === 'CANCELLED').length +
          previousOrders.filter(o => o.status === 'RETURNED').length)) * 100
      : 0
    const prevPendingOrders = previousOrders.filter(o => o.status === 'NEW').length

    // Calculate percentage changes
    const kpiChanges = {
      totalOrders: prevTotalOrders > 0 ? ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100 : 0,
      totalRevenue: prevTotalRevenue > 0 ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 : 0,
      deliveryRate: prevDeliveryRate > 0 ? ((deliveryRate - prevDeliveryRate) / prevDeliveryRate) * 100 : 0,
      pendingOrders: prevPendingOrders > 0 ? ((pendingOrders - prevPendingOrders) / prevPendingOrders) * 100 : 0
    }

    // Daily trend - last 7 days including today
    const dailyTrend = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(currentEnd)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const dayOrders = await db.order.findMany({
        where: {
          ...buildWhereClause(date, nextDate)
        },
        select: {
          status: true,
          codAmount: true
        }
      })

      const dayDelivered = dayOrders.filter(o => o.status === 'DELIVERED')
      const dayRevenue = dayDelivered.reduce((sum, o) => sum + o.codAmount, 0)

      dailyTrend.push({
        date: date.toISOString().split('T')[0],
        orders: dayOrders.length,
        revenue: dayRevenue,
        delivered: dayDelivered.length
      })
    }

    // Status breakdown
    const statusCounts = currentOrders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count
    }))

    // Top 5 cities by order count
    const cityCounts = currentOrders.reduce((acc, o) => {
      const deliveredRevenue = o.status === 'DELIVERED' ? o.codAmount : 0
      if (!acc[o.city]) {
        acc[o.city] = { count: 0, revenue: 0 }
      }
      acc[o.city].count++
      acc[o.city].revenue += deliveredRevenue
      return acc
    }, {} as Record<string, { count: number; revenue: number }>)

    const topCities = Object.entries(cityCounts)
      .map(([city, data]) => ({ city, count: data.count, revenue: data.revenue }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Top 5 products by quantity sold
    const productSales = new Map<string, { productName: string; count: number; revenue: number }>()

    currentOrders.forEach(order => {
      if (order.status === 'DELIVERED') {
        order.items.forEach(item => {
          const existing = productSales.get(item.productId)
          if (existing) {
            existing.count += item.quantity
            existing.revenue += item.unitPrice * item.quantity
          } else {
            productSales.set(item.productId, {
              productName: item.product.name,
              count: item.quantity,
              revenue: item.unitPrice * item.quantity
            })
          }
        })
      }
    })

    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Recent orders (last 10)
    const recentOrders = currentOrders
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map(o => ({
        id: o.id,
        trackingNumber: o.trackingNumber,
        customerName: o.recipientName,
        phone: o.phone,
        city: o.city,
        status: o.status,
        codAmount: o.codAmount,
        source: o.source,
        createdAt: o.createdAt.toISOString()
      }))

    return NextResponse.json({
      kpis: {
        totalOrders,
        confirmedOrders,
        deliveredOrders,
        cancelledOrders,
        deliveryRate: Math.round(deliveryRate),
        totalRevenue,
        pendingOrders,
        averageOrderValue: Math.round(averageOrderValue)
      },
      kpiChanges,
      dailyTrend,
      statusBreakdown,
      topCities,
      topProducts,
      recentOrders
    })
  } catch (error) {
    console.error('Admin dashboard error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
