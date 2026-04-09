import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminSession, checkPermission } from '@/lib/admin-auth'

interface FinanceOverview {
  // Current period metrics
  current: {
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    platformFees: number
    callCenterExpenses: number
    deliveryFees: number
    sellerExpenses: number
    orderCount: number
  }
  // Comparison metrics
  comparison: {
    revenue: { current: number; previous: number; change: number; changePercent: number }
    expenses: { current: number; previous: number; change: number; changePercent: number }
    netProfit: { current: number; previous: number; change: number; changePercent: number }
  }
  // Pending items
  pending: {
    codAmounts: number
    withdrawalRequests: number
    withdrawalAmount: number
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission - finance viewing requires reports:view_all
    const permissionCheck = checkPermission(session.role as any, 'reports:view_all')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d' // today | 7d | 30d | 90d

    // Get date ranges
    const getDateRange = (period: string) => {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      switch (period) {
        case 'today':
          return { start: today, end: now }
        case '7d':
          const weekAgo = new Date(today)
          weekAgo.setDate(weekAgo.getDate() - 7)
          return { start: weekAgo, end: now }
        case '30d':
          const monthAgo = new Date(today)
          monthAgo.setDate(monthAgo.getDate() - 30)
          return { start: monthAgo, end: now }
        case '90d':
          const threeMonthsAgo = new Date(today)
          threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90)
          return { start: threeMonthsAgo, end: now }
        default:
          return { start: today, end: now }
      }
    }

    const currentRange = getDateRange(period)
    const periodLength = currentRange.end.getTime() - currentRange.start.getTime()
    const previousStart = new Date(currentRange.start.getTime() - periodLength)
    const previousEnd = new Date(currentRange.end.getTime() - periodLength)

    // Helper to calculate metrics for a date range
    const calculateMetrics = async (start: Date, end: Date) => {
      // Revenue from delivered orders
      const deliveredOrders = await db.order.findMany({
        where: {
          status: 'DELIVERED',
          deliveredAt: {
            gte: start,
            lte: end
          }
        },
        select: {
          codAmount: true,
          platformFee: true
        }
      })

      const totalRevenue = deliveredOrders.reduce((sum, o) => sum + o.codAmount, 0)
      const platformFees = deliveredOrders.reduce((sum, o) => sum + o.platformFee, 0)

      // Regular seller expenses (SHIPPING, SOURCING, AD_SPEND, OTHER)
      const sellerExpenses = await db.expense.findMany({
        where: {
          category: { in: ['SHIPPING', 'SOURCING', 'AD_SPEND', 'OTHER'] },
          incurredAt: { gte: start, lte: end }
        },
        select: { amount: true }
      })
      const totalSellerExpenses = sellerExpenses.reduce((sum, e) => sum + e.amount, 0)

      // Call center expenses
      const ccExpenses = await db.expense.findMany({
        where: {
          category: 'CALL_CENTER',
          incurredAt: { gte: start, lte: end }
        },
        select: { amount: true }
      })
      const callCenterExpenses = ccExpenses.reduce((sum, e) => sum + e.amount, 0)

      // Delivery expenses
      const deliveryExpenses = await db.expense.findMany({
        where: {
          category: 'DELIVERY',
          incurredAt: { gte: start, lte: end }
        },
        select: { amount: true }
      })
      const deliveryFees = deliveryExpenses.reduce((sum, e) => sum + e.amount, 0)

      const totalExpenses = totalSellerExpenses + callCenterExpenses + deliveryFees
      const netProfit = totalRevenue - totalExpenses

      return {
        totalRevenue,
        totalExpenses,
        netProfit,
        platformFees,
        callCenterExpenses,
        deliveryFees,
        sellerExpenses: totalSellerExpenses,
        orderCount: deliveredOrders.length
      }
    }

    // Calculate current and previous period metrics
    const current = await calculateMetrics(currentRange.start, currentRange.end)
    const previous = await calculateMetrics(previousStart, previousEnd)

    // Calculate comparison
    const comparison = {
      revenue: {
        current: current.totalRevenue,
        previous: previous.totalRevenue,
        change: current.totalRevenue - previous.totalRevenue,
        changePercent: previous.totalRevenue > 0
          ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100
          : 0
      },
      expenses: {
        current: current.totalExpenses,
        previous: previous.totalExpenses,
        change: current.totalExpenses - previous.totalExpenses,
        changePercent: previous.totalExpenses > 0
          ? ((current.totalExpenses - previous.totalExpenses) / previous.totalExpenses) * 100
          : 0
      },
      netProfit: {
        current: current.netProfit,
        previous: previous.netProfit,
        change: current.netProfit - previous.netProfit,
        changePercent: previous.netProfit > 0
          ? ((current.netProfit - previous.netProfit) / Math.abs(previous.netProfit)) * 100
          : 0
      }
    }

    // Pending COD amounts (orders not yet delivered)
    const pendingOrders = await db.order.findMany({
      where: {
        status: { notIn: ['DELIVERED', 'CANCELLED', 'RETURNED'] }
      },
      select: { codAmount: true }
    })
    const pendingCodAmounts = pendingOrders.reduce((sum, o) => sum + o.codAmount, 0)

    // Withdrawal requests summary
    const withdrawalRequests = await db.withdrawalRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        wallet: {
          select: {
            seller: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    const pending = {
      codAmounts: pendingCodAmounts,
      withdrawalRequests: withdrawalRequests.length,
      withdrawalAmount: withdrawalRequests.reduce((sum, w) => sum + w.amount, 0)
    }

    const financeOverview: FinanceOverview = {
      current,
      comparison,
      pending
    }

    return NextResponse.json(financeOverview)
  } catch (error) {
    console.error('Finance overview error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
