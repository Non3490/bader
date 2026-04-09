import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { scopeByRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { autoAssignOrder } from '@/lib/agent-assign'
import { detectAndAssignBundle } from '@/lib/bundle-detection'
import { getCustomerDeliveryRate } from '@/lib/customer-stats'
import { validateStockAvailability } from '@/lib/stock-service'

/**
 * Calculate priority score for an order.
 * Higher score = higher priority.
 *
 * Scoring factors:
 * - Delivery rate > 60%: +500
 * - Multiple items: +100 per extra item
 * - Age: +1 per minute
 * - Duplicate orders: -1000
 * - Blacklisted: -2000
 */
function calculatePriorityScore(order: any, isBlacklisted: boolean, deliveryRate?: number): number {
  let score = 0

  // Age: +1 per minute since creation
  const ageMinutes = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)
  score += ageMinutes

  // Delivery rate > 60%: +500
  if (deliveryRate && deliveryRate > 0.6) {
    score += 500
  }

  // Multiple items: +100 per extra item
  if (order.items && order.items.length > 1) {
    score += (order.items.length - 1) * 100
  }

  // Duplicate orders: -1000
  if (order.status === 'DOUBLE') {
    score -= 1000
  }

  // Blacklisted: -2000
  if (isBlacklisted) {
    score -= 2000
  }

  return score
}

// GET /api/orders
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const city = searchParams.get('city')
    const search = searchParams.get('search')
    const source = searchParams.get('source')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: Prisma.OrderWhereInput = { ...scopeByRole(user.id, user.role, user.parentSellerId) }

    if (status && status !== 'ALL') where.status = status
    if (city) where.city = { contains: city }
    if (source) where.source = source

    if (search) {
      where.OR = [
        { recipientName: { contains: search } },
        { phone: { contains: search } },
        { trackingNumber: { contains: search } },
        { address: { contains: search } }
      ]
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(dateFrom)
      if (dateTo) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(dateTo + 'T23:59:59')
    }

    // For NEW status: use priority scoring and filter future scheduled orders
    const isNewStatus = status === 'NEW'
    if (isNewStatus) {
      // Hide orders with future scheduled callbacks
      where.OR = [
        { scheduledCallAt: null },
        { scheduledCallAt: { lte: new Date() } }
      ]
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          seller: { select: { id: true, name: true, email: true } },
          deliveryMan: { select: { id: true, name: true } },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  sellPrice: true
                  // Note: costPrice is already excluded from select
                }
              }
            }
          },
          callLogs: { select: { id: true, attempt: true, createdAt: true }, orderBy: { createdAt: 'desc' as const }, take: 5 }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.order.count({ where })
    ])

    // Strip cost-related fields for CALL_CENTER role
    const shouldStripCost = user.role === 'CALL_CENTER'

    // For NEW status: fetch blacklist status and delivery rates for priority scoring
    let blacklistSet = new Set<string>()
    let deliveryRates = new Map<string, number>()

    if (isNewStatus) {
      const phoneNumbers = [...new Set(orders.map(o => o.phone))]

      // Fetch blacklisted numbers
      const blacklisted = await db.blacklist.findMany({
        where: { phone: { in: phoneNumbers }, isActive: true },
        select: { phone: true }
      })
      blacklistSet = new Set(blacklisted.map(b => b.phone))

      // Fetch delivery rates from Customer model
      for (const phone of phoneNumbers) {
        const rate = await getCustomerDeliveryRate(phone)
        if (rate !== undefined) {
          deliveryRates.set(phone, rate)
        }
      }
    }

    // Add backward-compat aliases for existing UI pages
    const mappedOrders = orders.map(o => {
      const isBlacklisted = isNewStatus ? blacklistSet.has(o.phone) : false
      const deliveryRate = isNewStatus ? deliveryRates.get(o.phone) : undefined
      const priorityScore = isNewStatus ? calculatePriorityScore(o, isBlacklisted, deliveryRate) : 0

      const order: any = {
        ...o,
        customerName: o.recipientName,
        customerPhone: o.phone,
        customerAddress: o.address,
        notes: o.note
      }
      if (shouldStripCost) {
        delete order.productCost
        delete order.shippingCost
        delete order.callCenterFee
        delete order.adSpend
      }
      // Add isBlacklisted and priorityScore for NEW orders
      if (isNewStatus) {
        order.isBlacklisted = isBlacklisted
        order.priorityScore = priorityScore
      }
      return order
    })

    // For NEW status: sort by priority score descending
    if (isNewStatus) {
      mappedOrders.sort((a: any, b: any) => b.priorityScore - a.priorityScore)
    }

    return NextResponse.json({
      orders: mappedOrders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error('Orders GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/orders
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    // Accept both new field names (recipientName/phone/address) and legacy (customerName/customerPhone/customerAddress)
    const recipientName = body.recipientName || body.customerName
    const phone = body.phone || body.customerPhone
    const address = body.address || body.customerAddress
    const {
      city, note, codAmount,
      source = 'MANUAL', items = [],
      sellerId, productId, quantity = 1
    } = body

    if (!recipientName || !phone || !address || !city || !codAmount) {
      return NextResponse.json(
        { error: 'Missing required fields: recipientName, phone, address, city, codAmount' },
        { status: 400 }
      )
    }

    const effectiveSellerId = user.role === 'ADMIN' && sellerId ? sellerId : user.id

    // Support legacy single-product form
    let orderItems: Array<{ productId: string; quantity: number; unitPrice: number }> = items
    if (orderItems.length === 0 && productId) {
      const product = await db.product.findUnique({ where: { id: productId } })
      if (product) orderItems = [{ productId, quantity: parseInt(String(quantity)), unitPrice: product.sellPrice }]
    }

    // CORE-04: Validate stock availability before creating order
    const stockValidation = await validateStockAvailability(orderItems)
    if (!stockValidation.valid) {
      const errorMessages = stockValidation.errors.map(e =>
        `Stock insuffisant pour ${e.productName}: disponible ${e.available}, demandé ${e.requested}`
      )
      return NextResponse.json(
        {
          error: 'Stock insuffisant',
          details: errorMessages
        },
        { status: 400 }
      )
    }

    // Deduplication: same phone + same product within 15 days
    if (phone && orderItems.length > 0) {
      const fifteenDaysAgo = new Date()
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
      const duplicate = await db.order.findFirst({
        where: {
          phone: phone.trim(),
          sellerId: effectiveSellerId,
          items: { some: { productId: { in: orderItems.map(i => i.productId) } } },
          createdAt: { gte: fifteenDaysAgo }
        }
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Duplicate order detected — same customer and product within 15 days', duplicateOrderId: duplicate.id },
          { status: 409 }
        )
      }
    }

    // Generate unique tracking number
    let trackingNumber = ''
    for (let i = 0; i < 10; i++) {
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
      trackingNumber = `GC-${rand}`
      const exists = await db.order.findUnique({ where: { trackingNumber } })
      if (!exists) break
    }

    const order = await db.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          trackingNumber,
          sellerId: effectiveSellerId,
          recipientName,
          phone,
          address,
          city,
          note,
          codAmount: parseFloat(String(codAmount)),
          source,
          items: orderItems.length > 0 ? {
            create: orderItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            }))
          } : undefined,
          history: { create: { newStatus: 'NEW', changedById: user.id } }
        },
        include: {
          seller: { select: { id: true, name: true } },
          items: { include: { product: true } },
          history: true
        }
      })
    })

    // Auto-assign to lightest-load CALL_CENTER agent (fire-and-forget)
    autoAssignOrder(order.id, user.role === 'SELLER' ? user.id : null).catch(err =>
      console.error(`[AUTO-ASSIGN] Failed for order ${order.id}:`, err)
    )

    // Check for bundle detection (same phone + same day + 2+ sellers)
    detectAndAssignBundle(order.id).catch((error) => {
      console.error('Bundle detection error:', error)
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    console.error('Orders POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
