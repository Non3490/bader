/**
 * Bundle Detection Service
 * Automatically groups orders from the same customer (same phone number)
 * when they place orders from different sellers on the same day.
 */

import { db } from '@/lib/db'
import { broadcastBundleDetection } from '@/lib/pusher'

// Use built-in crypto.randomUUID() for generating bundle IDs
const cuid = () => crypto.randomUUID()

/**
 * Detect if a new order should be bundled with existing orders from the same customer.
 * Bundle criteria: Same phone + Same day + 2+ different sellers + Status is NEW or CONFIRMED
 *
 * @param orderId - The ID of the newly created order
 * @returns Promise<void>
 */
export async function detectAndAssignBundle(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { seller: true },
  })

  if (!order) {
    console.warn(`[BundleDetection] Order not found: ${orderId}`)
    return
  }

  const { phone, sellerId, createdAt } = order

  // Get start and end of the order's day
  const startOfDay = new Date(createdAt)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(createdAt)
  endOfDay.setHours(23, 59, 59, 999)

  // Find orders from same phone number on the same day
  const sameDayOrders = await db.order.findMany({
    where: {
      phone: phone.trim(),
      createdAt: { gte: startOfDay, lte: endOfDay },
      status: { in: ['NEW', 'CONFIRMED'] },
    },
    include: { seller: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  // Check for multiple sellers (bundle criterion)
  const uniqueSellers = new Set(sameDayOrders.map(o => o.sellerId))

  if (uniqueSellers.size < 2) {
    // Not a bundle - only one seller or no matching orders
    return
  }

  // Create or reuse bundle group ID
  const existingBundle = sameDayOrders.find(o => o.bundleGroupId)
  const bundleGroupId = existingBundle?.bundleGroupId || cuid()

  // Update all orders in the bundle
  await db.order.updateMany({
    where: {
      id: { in: sameDayOrders.map(o => o.id) },
    },
    data: { bundleGroupId },
  })

  const sellerCount = uniqueSellers.size
  const orderCount = sameDayOrders.length
  const customerName = order.recipientName

  console.log(`[BundleDetection] Created bundle ${bundleGroupId}: ${orderCount} orders from ${sellerCount} sellers for ${customerName}`)

  // Trigger Pusher event
  broadcastBundleDetection({
    bundleGroupId,
    orderCount,
    customerPhone: phone,
    customerName,
    totalCodAmount: sameDayOrders.reduce((acc, o) => acc + o.codAmount, 0),
    timestamp: new Date().toISOString()
  }).catch(err => console.error('Failed to broadcast bundle detection:', err))

  return {
    bundleGroupId,
    orderCount,
    sellerCount,
    customerName,
    customerPhone: phone,
    orders: sameDayOrders.map(o => ({
      id: o.id,
      trackingNumber: o.trackingNumber,
      sellerId: o.sellerId,
      sellerName: o.seller?.name || 'Unknown',
    }))
  }
}

/**
 * Check and assign bundle for existing orders (useful for data migration or manual trigger)
 *
 * @param date - Optional date to check, defaults to today
 */
export async function runBundleDetectionForDate(date: Date = new Date()) {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  // Find all NEW/CONFIRMED orders for the day
  const allOrders = await db.order.findMany({
    where: {
      createdAt: { gte: startOfDay, lte: endOfDay },
      status: { in: ['NEW', 'CONFIRMED'] },
    },
    include: { seller: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  // Group orders by phone
  const phoneGroups = new Map<string, typeof allOrders>()
  for (const order of allOrders) {
    const phone = order.phone.trim()
    if (!phoneGroups.has(phone)) {
      phoneGroups.set(phone, [])
    }
    phoneGroups.get(phone)!.push(order)
  }

  // Process each phone group
  const results: any[] = []

  for (const [phone, orders] of phoneGroups.entries()) {
    const uniqueSellers = new Set(orders.map(o => o.sellerId))

    if (uniqueSellers.size >= 2) {
      // This is a bundle - assign or reuse bundle group ID
      const existingBundle = orders.find(o => o.bundleGroupId)
      const bundleGroupId = existingBundle?.bundleGroupId || cuid()

      await db.order.updateMany({
        where: {
          id: { in: orders.map(o => o.id) },
        },
        data: { bundleGroupId },
      })

      results.push({
        bundleGroupId,
        orderCount: orders.length,
        sellerCount: uniqueSellers.size,
        customerPhone: phone,
        customerName: orders[0].recipientName,
      })
    }
  }

  return results
}

/**
 * Get all orders in a bundle group
 *
 * @param bundleGroupId - The bundle group ID
 */
export async function getBundleOrders(bundleGroupId: string) {
  const orders = await db.order.findMany({
    where: {
      bundleGroupId,
      status: { notIn: ['CANCELLED', 'RETURN_TO_STOCK'] },
    },
    include: {
      seller: { select: { id: true, name: true, email: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return orders
}

/**
 * Get bundle statistics
 *
 * @param bundleGroupId - The bundle group ID
 */
export async function getBundleStats(bundleGroupId: string) {
  const orders = await getBundleOrders(bundleGroupId)

  if (orders.length === 0) {
    return null
  }

  const uniqueSellers = new Set(orders.map(o => o.sellerId))
  const totalItems = orders.reduce((sum, o) => sum + o.items.reduce((is, i) => is + i.quantity, 0), 0)
  const totalCod = orders.reduce((sum, o) => sum + o.codAmount, 0)

  return {
    bundleGroupId,
    orderCount: orders.length,
    sellerCount: uniqueSellers.size,
    totalItems,
    totalCod,
    customerName: orders[0].recipientName,
    customerPhone: orders[0].phone,
    customerAddress: orders[0].address,
    city: orders[0].city,
    orders: orders.map(o => ({
      id: o.id,
      trackingNumber: o.trackingNumber,
      sellerId: o.sellerId,
      sellerName: o.seller?.name,
      codAmount: o.codAmount,
      itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
      productNames: o.items.map(i => i.product.name).join(', '),
    }))
  }
}
