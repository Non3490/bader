import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminSession, checkPermission } from '@/lib/admin-auth'

// Analytics Types
type AnalyticsPeriod = 'today' | '7d' | '30d' | '90d'
type AnalyticsType = 'overview' | 'sellers' | 'products' | 'zones' | 'customers'

interface SellerPerformance {
  sellerId: string
  sellerName: string
  sellerEmail: string
  totalOrders: number
  deliveredOrders: number
  revenue: number
  expenses: number
  netProfit: number
  deliveryRate: number
  averageOrderValue: number
  lastOrderDate: Date | null
}

interface ProductPerformance {
  productId: string
  productName: string
  totalQuantity: number
  deliveredQuantity: number
  totalRevenue: number
  averagePrice: number
  returnRate: number
  category: string | null
}

interface DeliveryZoneAnalytics {
  zoneId: string
  zoneName: string
  city: string
  totalOrders: number
  deliveredOrders: number
  returnedOrders: number
  deliveryRate: number
  totalRevenue: number
  driverId: string | null
  driverName: string | null
}

interface CustomerInsights {
  totalCustomers: number
  newCustomers: number
  repeatCustomers: number
  repeatRate: number
  averageOrderValue: number
  topCustomers: Array<{
    phone: string
    orderCount: number
    totalSpent: number
    deliveredCount: number
    lastOrderDate: Date
  }>
  customerLifetimeValue: number
}

interface AnalyticsResponse {
  period: AnalyticsPeriod
  overview?: {
    totalOrders: number
    totalRevenue: number
    totalSellers: number
    totalProducts: number
    totalZones: number
  }
  sellers?: SellerPerformance[]
  products?: ProductPerformance[]
  zones?: DeliveryZoneAnalytics[]
  customers?: CustomerInsights
}

// Helper function to get date range
function getDateRange(period: AnalyticsPeriod): { start: Date; end: Date } {
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

// Seller Performance Analytics
async function getSellerPerformanceAnalytics(startDate: Date, endDate: Date): Promise<SellerPerformance[]> {
  const sellers = await db.user.findMany({
    where: { role: 'SELLER' },
    include: {
      orders: {
        where: {
          createdAt: { gte: startDate, lte: endDate }
        }
      },
      expenses: {
        where: {
          incurredAt: { gte: startDate, lte: endDate }
        }
      }
    }
  })

  const performance: SellerPerformance[] = sellers.map(seller => {
    const totalOrders = seller.orders.length
    const deliveredOrders = seller.orders.filter(o => o.status === 'DELIVERED').length
    const revenue = seller.orders.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + o.codAmount, 0)
    const expenses = seller.expenses.reduce((sum, e) => sum + e.amount, 0)
    const deliveryRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0
    const averageOrderValue = deliveredOrders > 0 ? revenue / deliveredOrders : 0

    // Get last order date
    const lastOrderDate = seller.orders.length > 0
      ? seller.orders.reduce((latest, order) =>
          order.createdAt > latest ? order.createdAt : latest,
          seller.orders[0].createdAt
        )
      : null

    return {
      sellerId: seller.id,
      sellerName: seller.name,
      sellerEmail: seller.email,
      totalOrders,
      deliveredOrders,
      revenue,
      expenses,
      netProfit: revenue - expenses,
      deliveryRate,
      averageOrderValue,
      lastOrderDate
    }
  })

  // Sort by revenue descending
  return performance.sort((a, b) => b.revenue - a.revenue)
}

// Product Performance Analytics
async function getProductPerformanceAnalytics(startDate: Date, endDate: Date): Promise<ProductPerformance[]> {
  const orderItems = await db.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: startDate, lte: endDate }
      }
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          category: true
        }
      },
      order: {
        select: {
          status: true
        }
      }
    }
  })

  const productMap = new Map<string, ProductPerformance>()

  for (const item of orderItems) {
    const existing = productMap.get(item.productId)

    if (existing) {
      existing.totalQuantity += item.quantity
      if (item.order.status === 'DELIVERED') {
        existing.deliveredQuantity += item.quantity
        existing.totalRevenue += item.unitPrice * item.quantity
      }
      if (item.order.status === 'RETURNED') {
        existing.returnRate = ((existing.returnRate * (existing.totalQuantity - item.quantity)) + item.quantity) / existing.totalQuantity
      }
    } else {
      const isDelivered = item.order.status === 'DELIVERED'
      const isReturned = item.order.status === 'RETURNED'

      productMap.set(item.productId, {
        productId: item.productId,
        productName: item.product.name,
        totalQuantity: item.quantity,
        deliveredQuantity: isDelivered ? item.quantity : 0,
        totalRevenue: isDelivered ? item.unitPrice * item.quantity : 0,
        averagePrice: item.unitPrice,
        returnRate: isReturned ? 100 : 0,
        category: item.product.category
      })
    }
  }

  return Array.from(productMap.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
}

// Delivery Zone Analytics
async function getDeliveryZoneAnalytics(startDate: Date, endDate: Date): Promise<DeliveryZoneAnalytics[]> {
  const zones = await db.deliveryZone.findMany({
    include: {
      driver: {
        select: {
          id: true,
          name: true
        }
      },
      orders: {
        where: {
          createdAt: { gte: startDate, lte: endDate }
        }
      }
    }
  })

  return zones.map(zone => {
    const totalOrders = zone.orders.length
    const deliveredOrders = zone.orders.filter(o => o.status === 'DELIVERED').length
    const returnedOrders = zone.orders.filter(o => o.status === 'RETURNED').length
    const totalRevenue = zone.orders.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + o.codAmount, 0)
    const deliveryRate = (deliveredOrders + returnedOrders) > 0
      ? (deliveredOrders / (deliveredOrders + returnedOrders)) * 100
      : 0

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      city: zone.name.split(',')[0] || 'Unknown',
      totalOrders,
      deliveredOrders,
      returnedOrders,
      deliveryRate,
      totalRevenue,
      driverId: zone.driverId,
      driverName: zone.driver?.name || null
    }
  }).sort((a, b) => b.totalRevenue - a.totalRevenue)
}

// Customer Insights
async function getCustomerInsights(startDate: Date, endDate: Date): Promise<CustomerInsights> {
  // Get all customers (unique phone numbers) in the period
  const orders = await db.order.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate }
    },
    select: {
      phone: true,
      codAmount: true,
      status: true,
      createdAt: true
    }
  })

  const customerMap = new Map<string, {
    orderCount: number
    totalSpent: number
    deliveredCount: number
    lastOrderDate: Date
  }>()

  for (const order of orders) {
    const existing = customerMap.get(order.phone)

    if (existing) {
      existing.orderCount += 1
      if (order.status === 'DELIVERED') {
        existing.totalSpent += order.codAmount
        existing.deliveredCount += 1
      }
      if (order.createdAt > existing.lastOrderDate) {
        existing.lastOrderDate = order.createdAt
      }
    } else {
      customerMap.set(order.phone, {
        orderCount: 1,
        totalSpent: order.status === 'DELIVERED' ? order.codAmount : 0,
        deliveredCount: order.status === 'DELIVERED' ? 1 : 0,
        lastOrderDate: order.createdAt
      })
    }
  }

  const customers = Array.from(customerMap.entries()).map(([phone, data]) => ({
    phone,
    ...data
  }))

  const repeatCustomers = customers.filter(c => c.orderCount > 1).length
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0)
  const customerLifetimeValue = customers.length > 0 ? totalRevenue / customers.length : 0

  // Top customers by spent amount
  const topCustomers = customers
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10)
    .map(c => ({
      phone: c.phone,
      orderCount: c.orderCount,
      totalSpent: c.totalSpent,
      deliveredCount: c.deliveredCount,
      lastOrderDate: c.lastOrderDate
    }))

  // Get count of customers who had their first order before this period (for repeat calculation)
  const periodStart = startDate
  const newCustomers = customers.filter(c => {
    // This is a simplified check - in reality you'd need to check if this was their first order ever
    return true
  }).length

  return {
    totalCustomers: customers.length,
    newCustomers,
    repeatCustomers,
    repeatRate: customers.length > 0 ? (repeatCustomers / customers.length) * 100 : 0,
    averageOrderValue: customers.length > 0 ? totalRevenue / customers.length : 0,
    topCustomers,
    customerLifetimeValue
  }
}

// Overview Analytics
async function getOverviewAnalytics(startDate: Date, endDate: Date) {
  const [totalOrders, totalSellers, totalProducts, totalZones] = await Promise.all([
    db.order.count({
      where: { createdAt: { gte: startDate, lte: endDate } }
    }),
    db.user.count({ where: { role: 'SELLER' } }),
    db.product.count(),
    db.deliveryZone.count()
  ])

  const deliveredOrders = await db.order.findMany({
    where: {
      status: 'DELIVERED',
      deliveredAt: { gte: startDate, lte: endDate }
    },
    select: { codAmount: true }
  })

  const totalRevenue = deliveredOrders.reduce((sum, o) => sum + o.codAmount, 0)

  return {
    totalOrders,
    totalRevenue,
    totalSellers,
    totalProducts,
    totalZones
  }
}

// GET /api/admin/analytics
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
    const period = (searchParams.get('period') || '30d') as AnalyticsPeriod
    const type = (searchParams.get('type') || 'overview') as AnalyticsType

    const { start, end } = getDateRange(period)

    const response: AnalyticsResponse = { period }

    // Always include overview for basic stats
    if (type === 'overview' || type === 'sellers' || type === 'products' || type === 'zones' || type === 'customers') {
      response.overview = await getOverviewAnalytics(start, end)
    }

    // Add specific analytics based on type
    if (type === 'sellers' || type === 'overview') {
      response.sellers = await getSellerPerformanceAnalytics(start, end)
    }

    if (type === 'products' || type === 'overview') {
      response.products = await getProductPerformanceAnalytics(start, end)
    }

    if (type === 'zones' || type === 'overview') {
      response.zones = await getDeliveryZoneAnalytics(start, end)
    }

    if (type === 'customers' || type === 'overview') {
      response.customers = await getCustomerInsights(start, end)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
