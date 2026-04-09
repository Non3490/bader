import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

interface SellerRanking {
  sellerId: string
  sellerName: string
  sellerEmail: string
  totalRevenue: number
  orderVolume: number
  deliveryRate: number
  confirmationRate: number
  avgOrderValue: number
  rank?: number
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

    // Get order stats for each seller
    const sellerStats = await Promise.all(
      sellers.map(async (seller) => {
        const orders = await db.order.findMany({
          where: {
            sellerId: seller.id,
            createdAt: { gte: startDate }
          }
        })

        const totalOrders = orders.length
        const confirmedOrders = orders.filter(o => o.status === 'CONFIRMED' || ['SHIPPED', 'DELIVERED'].includes(o.status)).length
        const deliveredOrders = orders.filter(o => o.status === 'DELIVERED').length
        const returnedOrders = orders.filter(o => o.status === 'RETURNED').length

        const totalRevenue = orders
          .filter(o => o.status === 'DELIVERED')
          .reduce((sum, o) => sum + (o.codAmount || 0), 0)

        return {
          sellerId: seller.id,
          sellerName: seller.name,
          sellerEmail: seller.email,
          totalRevenue,
          orderVolume: totalOrders,
          deliveredOrders,
          confirmedOrders,
          returnedOrders,
          deliveryRate: totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0,
          confirmationRate: totalOrders > 0 ? (confirmedOrders / totalOrders) * 100 : 0,
          avgOrderValue: deliveredOrders > 0 ? totalRevenue / deliveredOrders : 0
        }
      })
    )

    // Filter out sellers with no orders
    const activeSellers = sellerStats.filter(s => s.orderVolume > 0)

    // Sort by revenue descending
    activeSellers.sort((a, b) => b.totalRevenue - a.totalRevenue)

    // Add ranks
    const rankedSellers: SellerRanking[] = activeSellers.map((seller, index) => ({
      sellerId: seller.sellerId,
      sellerName: seller.sellerName,
      sellerEmail: seller.sellerEmail,
      totalRevenue: seller.totalRevenue,
      orderVolume: seller.orderVolume,
      deliveryRate: parseFloat(seller.deliveryRate.toFixed(1)),
      confirmationRate: parseFloat(seller.confirmationRate.toFixed(1)),
      avgOrderValue: Math.round(seller.avgOrderValue),
      rank: index + 1
    }))

    // Get top performer
    const topPerformer = rankedSellers[0] || null

    return NextResponse.json({
      sellers: rankedSellers,
      topPerformer,
      totalSellers: activeSellers.length,
      period
    })
  } catch (error) {
    console.error('Top sellers API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
