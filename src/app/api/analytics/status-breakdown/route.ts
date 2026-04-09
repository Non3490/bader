import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// Order statuses as per specification
const ORDER_STATUSES = [
  'NEW',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
  'POSTPONED',
  'NO_ANSWER',
  'BUSY',
  'CALLBACK',
  'UNREACHED',
  'WRONG_NUMBER',
  'DOUBLE',
  'RETURN_TO_STOCK'
]

interface StatusBreakdown {
  status: string
  count: number
  percentage: number
  color: string
}

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
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    let startDate: Date
    if (dateFrom) {
      startDate = new Date(dateFrom)
    } else {
      const days = period === 'today' ? 1 : period === '7d' ? 7 : period === '90d' ? 90 : 30
      startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }

    const baseWhere: any = {
      createdAt: { gte: startDate }
    }

    if (dateTo) {
      baseWhere.createdAt.lte = new Date(dateTo)
    }

    if (session.role === 'SELLER') {
      baseWhere.sellerId = session.user.id
    } else if (sellerId && sellerId !== 'all') {
      baseWhere.sellerId = sellerId
    }

    if (city && city !== 'all') {
      baseWhere.city = city
    }

    // Get order counts by status
    const statusCounts = await db.order.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: baseWhere
    })

    const totalOrders = statusCounts.reduce((sum, s) => sum + s._count._all, 0)

    // Status color mapping (consistent with UI)
    const statusColors: Record<string, string> = {
      'DELIVERED': '#10b981',    // green
      'CONFIRMED': '#f59e0b',    // amber
      'SHIPPED': '#3b82f6',      // blue
      'NEW': '#6366f1',          // indigo
      'RETURNED': '#ef4444',     // red
      'CANCELLED': '#64748b',    // slate
      'POSTPONED': '#8b5cf6',    // purple
      'NO_ANSWER': '#f97316',    // orange
      'BUSY': '#ec4899',         // pink
      'CALLBACK': '#14b8a6',     // teal
      'UNREACHED': '#a855f7',    // violet
      'WRONG_NUMBER': '#eab308', // yellow
      'DOUBLE': '#06b6d4',       // cyan
      'RETURN_TO_STOCK': '#84cc16' // lime
    }

    // Build breakdown with all statuses (include zeros)
    const breakdown: StatusBreakdown[] = ORDER_STATUSES.map(status => {
      const found = statusCounts.find(s => s.status === status)
      const count = found?._count._all ?? 0
      return {
        status,
        count,
        percentage: totalOrders > 0 ? parseFloat(((count / totalOrders) * 100).toFixed(1)) : 0,
        color: statusColors[status] || '#94a3b8'
      }
    }).filter(s => s.count > 0) // Only include statuses with orders

    // Sort by count descending
    breakdown.sort((a, b) => b.count - a.count)

    return NextResponse.json({
      breakdown,
      totalOrders,
      period: dateFrom && dateTo ? 'custom' : period,
      dateFrom: startDate.toISOString(),
      dateTo: dateTo ? new Date(dateTo).toISOString() : new Date().toISOString()
    })
  } catch (error) {
    console.error('Status breakdown API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
