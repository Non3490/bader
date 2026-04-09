import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { scopeByRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || '30d'

    // Calculate date range based on period
    let dateFrom: Date | undefined
    let dateTo: Date = new Date()
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (period === 'custom') {
      // Handle custom date range
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('dateTo')
      if (startDate) {
        dateFrom = new Date(startDate)
      }
      if (endDate) {
        dateTo = new Date(endDate)
        dateTo.setHours(23, 59, 59, 999)
      }
    } else if (period === 'today') {
      dateFrom = todayStart
    } else if (period === '7d') {
      dateFrom = new Date(todayStart)
      dateFrom.setDate(dateFrom.getDate() - 7)
    } else if (period === '30d') {
      dateFrom = new Date(todayStart)
      dateFrom.setDate(dateFrom.getDate() - 30)
    }

    let whereCondition = scopeByRole(user.id, user.role, user.parentSellerId)
    if (dateFrom) {
      whereCondition = { ...whereCondition, createdAt: { gte: dateFrom, lte: dateTo } }
    }

    // CALL_CENTER should not see cost/profit data
    const isAdmin = user.role !== 'CALL_CENTER'
    const selectFields = {
      status: true,
      codAmount: true,
      createdAt: true,
      city: true
    } as const

    // Only select cost fields for non-CALL_CENTER roles
    const costFields = {
      productCost: true,
      shippingCost: true,
      callCenterFee: true,
      adSpend: true
    } as const

    const orders = await db.order.findMany({
      where: whereCondition,
      select: isAdmin ? { ...selectFields, ...costFields } : selectFields
    })

    const totalOrders = orders.length
    const delivered = orders.filter(o => o.status === 'DELIVERED')
    const totalRevenue = delivered.reduce((s, o) => s + o.codAmount, 0)

    // Only calculate profit for non-CALL_CENTER roles
    const totalCosts = isAdmin
      ? delivered.reduce((s, o) => s + (o.productCost ?? 0) + (o.shippingCost ?? 0) + (o.callCenterFee ?? 0) + (o.adSpend ?? 0), 0)
      : 0
    const totalProfit = isAdmin ? totalRevenue - totalCosts : 0

    const deliveredCount = delivered.length
    const confirmedCount = orders.filter(o => o.status === 'CONFIRMED').length
    const shippedCount = orders.filter(o => o.status === 'SHIPPED').length
    const returnedCount = orders.filter(o => o.status === 'RETURNED').length
    const cancelledCount = orders.filter(o => o.status === 'CANCELLED').length
    const newCount = orders.filter(o => o.status === 'NEW').length

    const closedCount = deliveredCount + returnedCount + cancelledCount
    const deliveryRate = closedCount > 0
      ? parseFloat(((deliveredCount / closedCount) * 100).toFixed(1))
      : 0

    const cityStats = orders.reduce((acc, order) => {
      if (!acc[order.city]) acc[order.city] = { total: 0, delivered: 0 }
      acc[order.city].total++
      if (order.status === 'DELIVERED') acc[order.city].delivered++
      return acc
    }, {} as Record<string, { total: number; delivered: number }>)

    const recentOrders = await db.order.findMany({
      where: whereCondition,
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        trackingNumber: true,
        recipientName: true,
        phone: true,
        city: true,
        codAmount: true,
        status: true,
        createdAt: true,
        items: {
          take: 1,
          include: { product: { select: { name: true } } }
        }
      }
    })

    // Map recentOrders to include productName from first item
    const recentOrdersMapped = recentOrders.map(o => ({
      id: o.id,
      trackingNumber: o.trackingNumber,
      customerName: o.recipientName,
      customerPhone: o.phone,
      city: o.city,
      productName: o.items[0]?.product?.name ?? '—',
      codAmount: o.codAmount,
      status: o.status,
      createdAt: o.createdAt
    }))

    // Calculate days to show based on period
    let lastDays: string[]

    if (period === 'custom' && dateFrom && dateTo) {
      // For custom date range, generate all dates in the range
      lastDays = []
      const currentDate = new Date(dateFrom)
      while (currentDate <= dateTo) {
        lastDays.push(currentDate.toISOString().split('T')[0])
        currentDate.setDate(currentDate.getDate() + 1)
      }
    } else {
      // For preset periods, generate the standard number of days
      const daysToShow = period === 'today' ? 1 : (period === '7d' ? 7 : 30)
      lastDays = Array.from({ length: daysToShow }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - i)
        return date.toISOString().split('T')[0]
      }).reverse()
    }

    const ordersPerDay = lastDays.map(date => {
      const dayOrders = orders.filter(o => o.createdAt.toISOString().split('T')[0] === date)
      return {
        date,
        total: dayOrders.length,
        delivered: dayOrders.filter(o => o.status === 'DELIVERED').length
      }
    })

    // Admin-only stats
    let usersCount = 0
    let activeUsersCount = 0
    let productsCount = 0
    let lowStockProducts: { id: string; sku: string; name: string; quantity: number; alertLevel: number; warehouse: string }[] = []
    let onlineAgents: Array<{ id: string; name: string; email: string; lastSeen: string | null; isOnline: boolean; currentWorkload: number }> = []

    if (user.role === 'ADMIN') {
      const [uCount, auCount, pCount, allStocks, agents] = await Promise.all([
        db.user.count(),
        db.user.count({ where: { isActive: true } }),
        db.product.count(),
        db.stock.findMany({
          include: { product: { select: { id: true, sku: true, name: true } } }
        }),
        db.user.findMany({
          where: { role: 'CALL_CENTER' },
          select: {
            id: true,
            name: true,
            email: true,
            agentSession: {
              select: {
                id: true,
                isOnline: true,
                lastSeen: true,
                currentWorkload: true
              }
            }
          }
        })
      ])
      usersCount = uCount
      activeUsersCount = auCount
      productsCount = pCount
      lowStockProducts = allStocks
        .filter(s => s.quantity <= s.alertLevel)
        .map(s => ({
          id: s.product.id,
          sku: s.product.sku,
          name: s.product.name,
          quantity: s.quantity,
          alertLevel: s.alertLevel,
          warehouse: s.warehouse
        }))

      // Calculate isOnline for each agent (within 5 minutes)
      const now = new Date()
      onlineAgents = agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        email: agent.email,
        lastSeen: agent.agentSession?.lastSeen?.toISOString() || null,
        isOnline: agent.agentSession
          ? (now.getTime() - new Date(agent.agentSession.lastSeen).getTime()) < 300000
          : false,
        currentWorkload: agent.agentSession?.currentWorkload || 0
      }))
    }

    // Strip profit for CALL_CENTER role
    const stats = isAdmin ? {
      totalOrders,
      totalRevenue,
      totalProfit,
      deliveryRate,
      pendingOrders: newCount + confirmedCount,
      newOrders: newCount,
      confirmedOrders: confirmedCount,
      shippedOrders: shippedCount,
      deliveredOrders: deliveredCount,
      returnedOrders: returnedCount,
      cancelledOrders: cancelledCount
    } : {
      totalOrders,
      totalRevenue,
      deliveryRate,
      pendingOrders: newCount + confirmedCount,
      newOrders: newCount,
      confirmedOrders: confirmedCount,
      shippedOrders: shippedCount,
      deliveredOrders: deliveredCount,
      returnedOrders: returnedCount,
      cancelledOrders: cancelledCount
    }

    return NextResponse.json({
      stats,
      ordersPerDay,
      cityStats,
      recentOrders: recentOrdersMapped,
      usersCount,
      activeUsersCount,
      productsCount,
      lowStockProducts,
      onlineAgents
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
