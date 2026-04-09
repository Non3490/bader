/**
 * Driver Auto-Assignment Service
 * Automatically assigns SHIPPED orders to available drivers
 * based on workload (fewest active deliveries first)
 */

import { db } from '@/lib/db'

/**
 * Find the best available driver for auto-assignment
 * Priority: AVAILABLE status, then fewest active deliveries
 */
async function findBestDriver(): Promise<string | null> {
  // Get all AVAILABLE drivers
  const availableDrivers = await db.driver.findMany({
    where: {
      status: 'AVAILABLE',
      isActive: true
    },
    select: {
      id: true
    }
  })

  if (availableDrivers.length === 0) {
    return null
  }

  // For each available driver, count their active deliveries
  const driverWorkloads = await Promise.all(
    availableDrivers.map(async (driver) => {
      const activeCount = await db.delivery.count({
        where: {
          driverId: driver.id,
          status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] }
        }
      })

      return {
        driverId: driver.id,
        activeCount
      }
    })
  )

  // Sort by active count (ascending) and return the first
  driverWorkloads.sort((a, b) => a.activeCount - b.activeCount)

  return driverWorkloads[0]?.driverId || null
}

/**
 * Auto-assign an order to the best available driver
 * Called when an order is marked as SHIPPED
 *
 * @param orderId - The order ID to assign
 * @returns The created delivery record or null if no driver available
 */
export async function autoAssignOrder(orderId: string) {
  try {
    // Check if order exists and is SHIPPED
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        assignedDriverId: true
      }
    })

    if (!order) {
      console.warn(`[AutoAssign] Order ${orderId} not found`)
      return null
    }

    if (order.status !== 'SHIPPED') {
      console.warn(`[AutoAssign] Order ${orderId} is not SHIPPED (status: ${order.status})`)
      return null
    }

    // Check if already assigned
    if (order.assignedDriverId) {
      console.log(`[AutoAssign] Order ${orderId} already assigned to driver ${order.assignedDriverId}`)
      return null
    }

    // Check if delivery record already exists
    const existingDelivery = await db.delivery.findUnique({
      where: { orderId }
    })

    if (existingDelivery) {
      console.log(`[AutoAssign] Delivery record already exists for order ${orderId}`)
      return existingDelivery
    }

    // Find best driver
    const driverId = await findBestDriver()

    if (!driverId) {
      console.log(`[AutoAssign] No available drivers for order ${orderId}`)
      return null
    }

    // Create delivery record
    const delivery = await db.delivery.create({
      data: {
        orderId,
        driverId,
        status: 'ASSIGNED',
        assignedAt: new Date()
      }
    })

    // Update order with assigned driver
    await db.order.update({
      where: { id: orderId },
      data: { assignedDriverId: driverId }
    })

    console.log(`[AutoAssign] Order ${orderId} assigned to driver ${driverId}`)

    return delivery
  } catch (error) {
    console.error('[AutoAssign] Error assigning order:', error)
    return null
  }
}

/**
 * Auto-assign multiple orders in bulk
 * Useful for batch operations or catching up on missed assignments
 *
 * @param orderIds - Array of order IDs to assign
 * @returns Results with success/failure counts
 */
export async function autoAssignOrdersBulk(orderIds: string[]) {
  const results = {
    total: orderIds.length,
    assigned: 0,
    skipped: 0,
    failed: 0
  }

  for (const orderId of orderIds) {
    try {
      const result = await autoAssignOrder(orderId)
      if (result) {
        results.assigned++
      } else {
        results.skipped++
      }
    } catch {
      results.failed++
    }
  }

  console.log(`[AutoAssign] Bulk assignment complete:`, results)
  return results
}

/**
 * Get all SHIPPED orders that haven't been assigned yet
 * Useful for admin to see what needs manual assignment
 */
export async function getUnassignedShippedOrders() {
  const orders = await db.order.findMany({
    where: {
      status: 'SHIPPED',
      assignedDriverId: null,
      delivery: null // No delivery record exists
    },
    select: {
      id: true,
      trackingNumber: true,
      recipientName: true,
      address: true,
      city: true,
      codAmount: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  })

  return orders
}
