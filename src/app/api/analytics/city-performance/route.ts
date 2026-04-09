import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN' && session.role !== 'SELLER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '7d'
    const sellerId = searchParams.get('sellerId')

    // Calculate date range (7 days by default for the scenario)
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Build where clause
    const baseWhere: any = { createdAt: { gte: dateFrom } }
    if (sellerId) {
      baseWhere.sellerId = sellerId
    }

    // Get all cities with order counts for the period
    const cityStats = await db.order.groupBy({
      by: ['city'],
      _count: { _all: true },
      orderBy: { _count: { city: 'desc' } },
      where: baseWhere
    })

    // For each city, get detailed breakdown
    const cityPerformance = await Promise.all(
      cityStats.map(async (cityStat) => {
        const city = cityStat.city
        const cityOrders = await db.order.findMany({
          where: { ...baseWhere, city },
          select: { status: true, codAmount: true }
        })

        const leads = cityOrders.length
        const confirmed = cityOrders.filter(o => o.status === 'CONFIRMED').length
        const delivered = cityOrders.filter(o => o.status === 'DELIVERED').length
        const returned = cityOrders.filter(o => o.status === 'RETURNED').length
        const totalRevenue = cityOrders
          .filter(o => o.status === 'DELIVERED')
          .reduce((sum, o) => sum + (o.codAmount || 0), 0)

        const deliveryRate = leads > 0 ? parseFloat(((delivered / leads) * 100).toFixed(1)) : 0
        const confirmationRate = leads > 0 ? parseFloat(((confirmed / leads) * 100).toFixed(1)) : 0
        const returnRate = delivered > 0 ? parseFloat(((returned / delivered) * 100).toFixed(1)) : 0

        return {
          city,
          leads,
          confirmed,
          delivered,
          returned,
          deliveryRate,
          confirmationRate,
          returnRate,
          totalRevenue,
          avgOrderValue: delivered > 0 ? totalRevenue / delivered : 0
        }
      })
    )

    // Calculate overall metrics
    const allOrders = await db.order.findMany({
      where: baseWhere,
      select: { status: true, codAmount: true, createdAt: true }
    })

    const totalLeads = allOrders.length
    const totalConfirmed = allOrders.filter(o => o.status === 'CONFIRMED').length
    const totalDelivered = allOrders.filter(o => o.status === 'DELIVERED').length
    const totalReturned = allOrders.filter(o => o.status === 'RETURNED').length
    const totalRevenue = allOrders
      .filter(o => o.status === 'DELIVERED')
      .reduce((sum, o) => sum + (o.codAmount || 0), 0)

    // Average leads per day
    const avgLeadsPerDay = parseFloat((totalLeads / days).toFixed(1))

    // Overall rates
    const overallConfirmationRate = totalLeads > 0 ? parseFloat(((totalConfirmed / totalLeads) * 100).toFixed(1)) : 0
    const overallDeliveryRate = totalLeads > 0 ? parseFloat(((totalDelivered / totalLeads) * 100).toFixed(1)) : 0
    const overallReturnRate = totalDelivered > 0 ? parseFloat(((totalReturned / totalDelivered) * 100).toFixed(1)) : 0

    return NextResponse.json({
      period,
      dateFrom,
      days,
      cityPerformance,
      overallMetrics: {
        totalLeads,
        avgLeadsPerDay,
        totalConfirmed,
        totalDelivered,
        totalReturned,
        totalRevenue,
        confirmationRate: overallConfirmationRate,
        deliveryRate: overallDeliveryRate,
        returnRate: overallReturnRate
      }
    })
  } catch (error) {
    console.error('City performance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
