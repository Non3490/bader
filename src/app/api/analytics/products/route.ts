import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { scopeByRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

// GET /api/analytics/products — per-product status breakdown
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const period = searchParams.get('period') || '30d'
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const sellerId = searchParams.get('sellerId')
    const city = searchParams.get('city')

    const roleScope = scopeByRole(user.id, user.role, user.parentSellerId)

    // Get all order items in the period, grouped by product + status
    const orderItems = await db.orderItem.findMany({
      where: {
        order: {
          ...roleScope,
          createdAt: { gte: dateFrom },
          ...(sellerId && { sellerId }),
          ...(city && { city })
        }
      },
      select: {
        productId: true,
        quantity: true,
        order: { select: { status: true } },
        product: { select: { id: true, name: true, sku: true } }
      }
    })

    // Aggregate by product
    const productMap = new Map<string, {
      productId: string
      productName: string
      sku: string
      leads: number
      confirmed: number
      cancelled: number
      shipped: number
      delivered: number
      returned: number
    }>()

    for (const item of orderItems) {
      const pid = item.productId
      if (!productMap.has(pid)) {
        productMap.set(pid, {
          productId: pid,
          productName: item.product.name,
          sku: item.product.sku,
          leads: 0,
          confirmed: 0,
          cancelled: 0,
          shipped: 0,
          delivered: 0,
          returned: 0
        })
      }
      const entry = productMap.get(pid)!
      entry.leads++
      const s = item.order.status
      if (['CONFIRMED', 'SHIPPED', 'DELIVERED', 'RETURNED'].includes(s)) entry.confirmed++
      if (s === 'CANCELLED') entry.cancelled++
      if (['SHIPPED', 'DELIVERED', 'RETURNED'].includes(s)) entry.shipped++
      if (s === 'DELIVERED') entry.delivered++
      if (s === 'RETURNED') entry.returned++
    }

    const products = Array.from(productMap.values()).map(p => ({
      ...p,
      confirmationRate: p.leads > 0 ? parseFloat(((p.confirmed / p.leads) * 100).toFixed(1)) : 0,
      deliveryRate: p.shipped > 0 ? parseFloat(((p.delivered / p.shipped) * 100).toFixed(1)) : 0,
      returnRate: p.shipped > 0 ? parseFloat(((p.returned / p.shipped) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.leads - a.leads)

    return NextResponse.json({ products, period })
  } catch (error) {
    console.error('Analytics products error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
