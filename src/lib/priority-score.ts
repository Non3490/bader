interface OrderForScore {
  id: string
  createdAt: Date
  quantity: number
  totalAmount?: number | null
  customerPhone: string
  bundleGroupId?: string | null
  callAttempts?: number
  lastCallAt?: Date | null
  isBlacklisted?: boolean
  customerDeliveryRate?: number  // 0-1, fetched from customer record
}

/**
 * 6-Level priority score for call center queue ordering.
 * Higher score = called first.
 *
 * Score components:
 * 1. Customer delivery rate (0-40 points): higher rate = higher priority
 * 2. Order age (0-20 points): older orders = higher priority
 * 3. Order value (0-15 points): higher value = higher priority
 * 4. Bundle (0-15 points): bundled orders get priority to handle together
 * 5. Quantity (0-10 points): more items = higher priority
 * 6. Blacklist penalty (-50 points): blacklisted = moved to bottom
 */
export function calculatePriorityScore(order: OrderForScore): number {
  let score = 0

  // 1. Customer delivery rate (0-40 pts)
  const rate = order.customerDeliveryRate ?? 0.5  // default 50% if unknown
  score += rate * 40

  // 2. Order age (0-20 pts) — older gets higher score, max at 48 hours
  const ageHours = (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60)
  score += Math.min(ageHours / 48, 1) * 20

  // 3. Order value (0-15 pts)
  const value = order.totalAmount ?? 0
  // Scale: 0-50,000 XAF maps to 0-15 pts
  score += Math.min(value / 50000, 1) * 15

  // 4. Bundle bonus (15 pts if part of bundle)
  if (order.bundleGroupId) {
    score += 15
  }

  // 5. Quantity (0-10 pts)
  score += Math.min(order.quantity / 5, 1) * 10

  // 6. Blacklist penalty
  if (order.isBlacklisted) {
    score -= 50
  }

  return Math.max(0, score)
}

export type { OrderForScore }
