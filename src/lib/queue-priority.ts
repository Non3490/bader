export interface QueuePriorityInput {
  id: string
  scheduledCallAt: Date | null
  createdAt: Date
  customerDeliveryRate: number
  itemCount: number
  status: string
  phone: string
  isBlacklisted: boolean
  bundleGroupId: string | null
}

export type QueuePriorityBucket =
  | 'OVERDUE_CALLBACK'
  | 'UPCOMING_CALLBACK'
  | 'HIGH_VALUE'
  | 'STANDARD'

export interface QueuePriorityResult extends QueuePriorityInput {
  score: number
  isVisible: boolean
  isPriority: boolean
  bucket: QueuePriorityBucket
}

export function calculatePriorityScore(order: QueuePriorityInput, now: Date) {
  let score = 0
  let isVisible = true
  let bucket: QueuePriorityBucket = 'STANDARD'

  if (order.scheduledCallAt && order.scheduledCallAt <= now) {
    const minutesOverdue = Math.floor((now.getTime() - order.scheduledCallAt.getTime()) / 60000)
    score += 10000 + minutesOverdue
    bucket = 'OVERDUE_CALLBACK'
  } else if (order.scheduledCallAt) {
    const minutesUntil = Math.floor((order.scheduledCallAt.getTime() - now.getTime()) / 60000)
    if (minutesUntil <= 120) {
      score += 5000 + (120 - minutesUntil)
      bucket = 'UPCOMING_CALLBACK'
    } else {
      isVisible = false
      score = -999999
    }
  }

  if (order.customerDeliveryRate >= 60) {
    score += 500
    if (bucket === 'STANDARD') {
      bucket = 'HIGH_VALUE'
    }
  }

  score += order.itemCount * 100

  const minutesOld = Math.floor((now.getTime() - order.createdAt.getTime()) / 60000)
  score += minutesOld

  if (order.status === 'DOUBLE') {
    score -= 1000
  }

  if (order.isBlacklisted) {
    score -= 2000
  }

  const isPriority =
    bucket !== 'STANDARD' ||
    order.itemCount > 1 ||
    Boolean(order.bundleGroupId) ||
    order.isBlacklisted

  return { score, isVisible, isPriority, bucket }
}

export function sortQueueByPriority<T extends QueuePriorityInput>(orders: T[], now = new Date()) {
  return orders
    .map((order) => ({
      ...order,
      ...calculatePriorityScore(order, now)
    }))
    .filter((order) => order.isVisible)
    .sort((a, b) => b.score - a.score)
}
