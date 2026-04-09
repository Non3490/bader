import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

interface SellerFinance {
  sellerId: string
  sellerName: string
  revenue: number
  expenses: number
  feesCharged: number
  netProfit: number
  profitMargin: number
  orderCount: number
  deliveryRate: number
  profitTrend?: Array<{
    date: string
    profit: number
  }>
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '30d'
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Get all active sellers
    const sellers = await db.user.findMany({
      where: {
        role: 'SELLER',
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true
      },
      orderBy: { name: 'asc' }
    })

    // Get finance stats for each seller
    const sellerFinances: SellerFinance[] = await Promise.all(
      sellers.map(async (seller) => {
        const orders = await db.order.findMany({
          where: {
            sellerId: seller.id,
            createdAt: { gte: startDate }
          },
          include: {
            expense: true
          }
        })

        const deliveredOrders = orders.filter(o => o.status === 'DELIVERED')
        const orderCount = deliveredOrders.length

        // Revenue from delivered orders (COD amount)
        const revenue = deliveredOrders.reduce((sum, o) => sum + (o.codAmount || 0), 0)

        // Expenses from expense records
        const expenses = await db.expense.findMany({
          where: {
            sellerId: seller.id,
            incurredAt: { gte: startDate }
          }
        })
        const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)

        // Platform fees (5000 XAF per order as per schema)
        const feesCharged = orderCount * 5000

        // Net profit
        const netProfit = revenue - totalExpenses - feesCharged
        const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0

        // Delivery rate
        const deliveryRate = orders.length > 0 ? (orderCount / orders.length) * 100 : 0

        // Profit trend (daily)
        const profitTrend = await db.order.groupBy({
          by: ['createdAt'],
          where: {
            sellerId: seller.id,
            status: 'DELIVERED',
            createdAt: { gte: startDate }
          },
          _sum: { codAmount: true }
        })

        // Group by date for trend
        const dailyProfit = new Map<string, number>()
        for (const order of orders.filter(o => o.status === 'DELIVERED')) {
          const dateKey = order.createdAt.toISOString().split('T')[0]
          dailyProfit.set(dateKey, (dailyProfit.get(dateKey) || 0) + (order.codAmount || 0))
        }

        const trend = Array.from(dailyProfit.entries())
          .map(([date, profit]) => ({
            date,
            profit: profit - (feesCharged / days) // Rough daily allocation of fees
          }))
          .slice(-30) // Last 30 data points

        return {
          sellerId: seller.id,
          sellerName: seller.name,
          revenue,
          expenses: totalExpenses,
          feesCharged,
          netProfit,
          profitMargin: parseFloat(profitMargin.toFixed(1)),
          orderCount,
          deliveryRate: parseFloat(deliveryRate.toFixed(1)),
          profitTrend: trend
        }
      })
    )

    // Filter out sellers with no revenue
    const activeSellers = sellerFinances.filter(s => s.revenue > 0)

    // Sort by net profit descending
    activeSellers.sort((a, b) => b.netProfit - a.netProfit)

    // Calculate totals
    const totals = {
      totalRevenue: activeSellers.reduce((sum, s) => sum + s.revenue, 0),
      totalExpenses: activeSellers.reduce((sum, s) => sum + s.expenses, 0),
      totalFees: activeSellers.reduce((sum, s) => sum + s.feesCharged, 0),
      totalNetProfit: activeSellers.reduce((sum, s) => sum + s.netProfit, 0),
      avgProfitMargin: activeSellers.length > 0
        ? activeSellers.reduce((sum, s) => sum + s.profitMargin, 0) / activeSellers.length
        : 0
    }

    return NextResponse.json({
      sellers: activeSellers,
      totals,
      totalSellers: activeSellers.length,
      period
    })
  } catch (error) {
    console.error('Seller finance API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
