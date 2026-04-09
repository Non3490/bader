import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/analytics/revenue-daily
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'
    const sellerId = searchParams.get('sellerId')
    const city = searchParams.get('city')

    let startDate: Date, endDate: Date
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Handle custom date range
    const customStart = searchParams.get('dateFrom')
    const customEnd = searchParams.get('dateTo')

    if (customStart && customEnd && period === 'custom') {
      startDate = new Date(customStart)
      endDate = new Date(customEnd)
      endDate.setHours(23, 59, 59, 999)
    } else if (period === 'today') {
      startDate = todayStart
      endDate = new Date()
    } else if (period === '7d') {
      startDate = new Date(todayStart)
      startDate.setDate(startDate.getDate() - 7)
      endDate = now
    } else if (period === '90d') {
      startDate = new Date(todayStart)
      startDate.setDate(startDate.getDate() - 90)
      endDate = now
    } else {
      startDate = new Date(todayStart)
      startDate.setDate(startDate.getDate() - 30)
      endDate = now
    }

    // Build where clause
    const where: any = {
      status: 'DELIVERED',
      deliveredAt: { gte: startDate, lte: endDate }
    }
    if (sellerId) {
      where.sellerId = sellerId
    }
    if (city) {
      where.city = city
    }

    const orders = await db.order.findMany({
      where,
      select: {
        deliveredAt: true,
        codAmount: true
      }
    })

    // Group by date
    const dailyData: Record<string, number> = {}
    for (const order of orders) {
      if (!order.deliveredAt) continue
      const date = order.deliveredAt.toISOString().split('T')[0]
      dailyData[date] = (dailyData[date] || 0) + order.codAmount
    }

    // Generate all dates in the range to ensure continuity
    const daily = []
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0]
      daily.push({
        date: dateStr,
        revenue: dailyData[dateStr] || 0
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return NextResponse.json({ daily })
  } catch (error) {
    console.error('Analytics revenue-daily error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
