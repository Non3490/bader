import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

interface CategoryData {
  category: string
  orderCount: number
  productCount: number
  totalRevenue: number
  deliveryRate: number
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
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const baseWhere: any = {
      createdAt: { gte: startDate }
    }

    if (session.role === 'SELLER') {
      baseWhere.sellerId = session.user.id
    } else if (sellerId && sellerId !== 'all') {
      baseWhere.sellerId = sellerId
    }

    if (city && city !== 'all') {
      baseWhere.city = city
    }

    // Get all orders with their items and products
    const orders = await db.order.findMany({
      where: baseWhere,
      include: {
        items: {
          include: {
            product: {
              select: {
                category: true,
                id: true
              }
            }
          }
        }
      }
    })

    // Aggregate by category
    const categoryMap = new Map<string, {
      orderCount: number
      productCount: Set<string>
      totalRevenue: number
      deliveredCount: number
      totalCount: number
    }>()

    for (const order of orders) {
      for (const item of order.items) {
        const category = item.product.category || 'Uncategorized'

        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            orderCount: 0,
            productCount: new Set(),
            totalRevenue: 0,
            deliveredCount: 0,
            totalCount: 0
          })
        }

        const data = categoryMap.get(category)!
        data.productCount.add(item.product.id)
        data.totalRevenue += item.quantity * item.unitPrice
        data.totalCount++

        if (order.status === 'DELIVERED') {
          data.deliveredCount++
        }
      }
    }

    // Convert to array and calculate metrics
    const categories: CategoryData[] = Array.from(categoryMap.entries()).map(([category, data]) => {
      // Count unique orders for this category
      const orderSet = new Set<string>()
      for (const order of orders) {
        for (const item of order.items) {
          if ((item.product.category || 'Uncategorized') === category) {
            orderSet.add(order.id)
            break
          }
        }
      }

      return {
        category,
        orderCount: orderSet.size,
        productCount: data.productCount.size,
        totalRevenue: data.totalRevenue,
        deliveryRate: data.totalCount > 0
          ? parseFloat(((data.deliveredCount / data.totalCount) * 100).toFixed(1))
          : 0
      }
    })

    // Sort by order count descending
    categories.sort((a, b) => b.orderCount - a.orderCount)

    // Return top 10
    const topCategories = categories.slice(0, 10)

    return NextResponse.json({
      categories: topCategories,
      totalCategories: categories.length
    })
  } catch (error) {
    console.error('Categories analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
