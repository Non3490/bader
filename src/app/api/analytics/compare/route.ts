import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

interface FunnelProduct {
  productId: string
  productName: string
  leads: number
  confirmed: number
  shipped: number
  delivered: number
  returned: number
  confirmationRate: number
  deliveryRate: number
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '30d'
    const sellerId = searchParams.get('sellerId')
    const city = searchParams.get('city')
    const compare = searchParams.get('compare') === 'true' // Enable comparison mode

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const dateTo = new Date(Date.now())

    // Previous period (same duration before current period)
    const previousDateFrom = new Date(dateFrom.getTime() - days * 24 * 60 * 60 * 1000)
    const previousDateTo = dateFrom

    // Build base where clauses
    const baseWhere: any = { createdAt: { gte: dateFrom, lte: dateTo } }
    const previousBaseWhere: any = { createdAt: { gte: previousDateFrom, lte: previousDateTo } }

    if (sellerId) {
      baseWhere.sellerId = sellerId
      previousBaseWhere.sellerId = sellerId
    }
    if (city) {
      baseWhere.city = city
      previousBaseWhere.city = city
    }

    // Current period data
    const [currentOrders, currentDelivered] = await Promise.all([
      db.order.count({ where: { ...baseWhere, status: 'DELIVERED' } }),
      db.order.findMany({
        where: baseWhere,
        select: { id: true, status: true, codAmount: true }
      })
    ])

    // Previous period data
    const [previousOrders, previousDelivered] = await Promise.all([
      db.order.count({ where: { ...previousBaseWhere, status: 'DELIVERED' } }),
      db.order.findMany({
        where: previousBaseWhere,
        select: { id: true, status: true, codAmount: true }
      })
    ])

    // Calculate metrics
    const currentConfirmed = currentOrders.filter(o => o.status === 'CONFIRMED').length
    const currentShipped = currentOrders.filter(o => o.status === 'SHIPPED').length
    const currentReturned = currentOrders.filter(o => o.status === 'RETURNED').length
    const currentRevenue = currentDelivered.reduce((sum, o) => sum + (o.codAmount || 0), 0)
    const currentConfirmationRate = currentOrders.length > 0 ? (currentConfirmed / currentOrders.length) * 100 : 0
    const currentDeliveryRate = currentOrders.length > 0 ? (currentDelivered / currentOrders.length) * 100 : 0

    const previousConfirmed = previousOrders.filter(o => o.status === 'CONFIRMED').length
    const previousShipped = previousOrders.filter(o => o.status === 'SHIPPED').length
    const previousReturned = previousOrders.filter(o => o.status === 'RETURNED').length
    const previousRevenue = previousDelivered.reduce((sum, o) => sum + (o.codAmount || 0), 0)
    const previousConfirmationRate = previousOrders.length > 0 ? (previousConfirmed / previousOrders.length) * 100 : 0
    const previousDeliveryRate = previousOrders.length > 0 ? (previousDelivered / previousOrders.length) * 100 : 0

    // Calculate percent changes
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return { value: 0, direction: 'none' as const }
      const change = ((current - previous) / previous) * 100
      return {
        value: Math.abs(change),
        direction: change >= 0 ? 'up' as const : 'down' as const
      }
    }

    return NextResponse.json({
      period,
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
      compare,
      metrics: {
        orders: {
          current: currentOrders.length,
          previous: previousOrders.length,
          change: calculateChange(currentOrders.length, previousOrders.length)
        },
        delivered: {
          current: currentDelivered,
          previous: previousDelivered,
          change: calculateChange(currentDelivered, previousDelivered)
        },
        revenue: {
          current: currentRevenue,
          previous: previousRevenue,
          change: calculateChange(currentRevenue, previousRevenue)
        },
        confirmationRate: {
          current: currentConfirmationRate,
          previous: previousConfirmationRate,
          change: calculateChange(currentConfirmationRate, previousConfirmationRate)
        },
        deliveryRate: {
          current: currentDeliveryRate,
          previous: previousDeliveryRate,
          change: calculateChange(currentDeliveryRate, previousDeliveryRate)
        }
      }
    })
  } catch (error) {
    console.error('Analytics comparison error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
