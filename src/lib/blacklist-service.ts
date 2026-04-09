/**
 * Blacklist Auto-Flag Service
 * Automatically flags customers with poor performance metrics
 * Auto-flag conditions: total orders >= 3 AND confirmation rate < 60% AND delivery rate < 60%
 */

import { db } from '@/lib/db'

interface CustomerMetrics {
  phone: string
  totalOrders: number
  confirmedOrders: number
  deliveredOrders: number
  confirmationRate: number
  deliveryRate: number
  shouldFlag: boolean
}

/**
 * Get customer metrics by phone number
 */
export async function getCustomerMetrics(phone: string): Promise<CustomerMetrics | null> {
  const orders = await db.order.findMany({
    where: { phone: phone.trim() },
    select: { status: true }
  })

  if (orders.length === 0) return null

  const totalOrders = orders.length
  const confirmedOrders = orders.filter(o => o.status === 'CONFIRMED' || o.status === 'SHIPPED' || o.status === 'DELIVERED').length
  const deliveredOrders = orders.filter(o => o.status === 'DELIVERED').length

  const confirmationRate = totalOrders > 0 ? (confirmedOrders / totalOrders) * 100 : 0
  const deliveryRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0

  // Auto-flag condition: orders >= 3 AND confirmation rate < 60% AND delivery rate < 60%
  const shouldFlag =
    totalOrders >= 3 &&
    confirmationRate < 60 &&
    deliveryRate < 60

  return {
    phone,
    totalOrders,
    confirmedOrders,
    deliveredOrders,
    confirmationRate: Math.round(confirmationRate),
    deliveryRate: Math.round(deliveryRate),
    shouldFlag
  }
}

/**
 * Check and auto-flag customer if they meet the criteria
 * Returns true if customer was flagged, false otherwise
 */
export async function checkAndAutoFlagCustomer(phone: string): Promise<boolean> {
  const metrics = await getCustomerMetrics(phone)

  if (!metrics || !metrics.shouldFlag) {
    return false
  }

  // Check if already blacklisted and active
  const existingBlacklist = await db.blacklist.findUnique({
    where: { phone: phone.trim() }
  })

  if (existingBlacklist && existingBlacklist.isActive) {
    return false // Already blacklisted
  }

  // If exists but inactive, reactivate
  if (existingBlacklist && !existingBlacklist.isActive) {
    await db.blacklist.update({
      where: { id: existingBlacklist.id },
      data: {
        isActive: true,
        autoFlagged: true,
        removedAt: null,
        removedBy: null,
        reason: `Auto-flagged: ${metrics.totalOrders} orders, ${metrics.confirmationRate}% confirmation rate, ${metrics.deliveryRate}% delivery rate`,
        returnCount: metrics.totalOrders - metrics.deliveredOrders
      }
    })
    return true
  }

  // Create new blacklist entry
  await db.blacklist.create({
    data: {
      phone: phone.trim(),
      autoFlagged: true,
      reason: `Auto-flagged: ${metrics.totalOrders} orders, ${metrics.confirmationRate}% confirmation rate, ${metrics.deliveryRate}% delivery rate`,
      returnCount: metrics.totalOrders - metrics.deliveredOrders
    }
  })

  return true
}

/**
 * Run auto-flag check after order status update
 * Should be called whenever an order's status changes to CONFIRMED, DELIVERED, or RETURNED
 */
export async function runAutoFlagCheckAfterOrderUpdate(phone: string): Promise<{ flagged: boolean; metrics?: CustomerMetrics }> {
  const metrics = await getCustomerMetrics(phone)

  if (!metrics) {
    return { flagged: false }
  }

  if (metrics.shouldFlag) {
    const wasFlagged = await checkAndAutoFlagCustomer(phone)
    return { flagged: wasFlagged, metrics }
  }

  return { flagged: false, metrics }
}

/**
 * Get detailed statistics for a blacklisted phone number
 */
export async function getBlacklistStats(phone: string): Promise<CustomerMetrics | null> {
  return getCustomerMetrics(phone)
}
