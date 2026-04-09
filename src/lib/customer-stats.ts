import { db } from '@/lib/db'

/**
 * Update customer delivery rate when order status changes to DELIVERED or RETURNED.
 * Calculates and persists delivery rate to Customer model.
 *
 * @param phone - Customer phone number
 */
export async function updateCustomerDeliveryRate(phone: string): Promise<void> {
  if (!phone) return

  // Get all orders for this phone number
  const orders = await db.order.findMany({
    where: { phone: phone.trim() }
  })

  if (orders.length === 0) return

  // Count delivered orders
  const deliveredCount = orders.filter(o => o.status === 'DELIVERED').length

  // Calculate delivery rate (0.0 to 1.0)
  const deliveryRate = deliveredCount / orders.length

  // Update or create customer record
  await db.customer.upsert({
    where: { phone: phone.trim() },
    update: {
      deliveryRate,
      orderCount: orders.length,
      deliveredCount
    },
    create: {
      phone: phone.trim(),
      deliveryRate,
      orderCount: orders.length,
      deliveredCount
    }
  })
}

/**
 * Get customer delivery rate from database.
 *
 * @param phone - Customer phone number
 * @returns Delivery rate (0.0 to 1.0) or undefined if customer not found
 */
export async function getCustomerDeliveryRate(phone: string): Promise<number | undefined> {
  if (!phone) return undefined

  const customer = await db.customer.findUnique({
    where: { phone: phone.trim() },
    select: { deliveryRate: true }
  })

  return customer?.deliveryRate
}
