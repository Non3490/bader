import { db } from '@/lib/db'
import { setHours, setMinutes, addDays } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { sortQueueByPriority } from '@/lib/queue-priority'

const GABON_TZ = 'Africa/Libreville'

/**
 * Calculate next peak hour callback time based on Gabon timezone (UTC+1).
 * - Before 9 AM → schedule for today 9 AM
 * - Between 9 AM and 2 PM → schedule for today 2 PM
 * - After 2 PM → schedule for tomorrow 9 AM
 */
export function getNextPeakHour(): Date {
  const now = new Date()
  const gabonNow = toZonedTime(now, GABON_TZ)
  const currentHour = gabonNow.getHours()

  let scheduledTime: Date

  if (currentHour < 9) {
    // Before 9 AM: schedule for today 9 AM
    scheduledTime = setMinutes(setHours(gabonNow, 9), 0)
  } else if (currentHour >= 9 && currentHour < 14) {
    // 9 AM to 2 PM: schedule for today 2 PM
    scheduledTime = setMinutes(setHours(gabonNow, 14), 0)
  } else {
    // After 2 PM: schedule for tomorrow 9 AM
    scheduledTime = setMinutes(setHours(addDays(gabonNow, 1), 9), 0)
  }

  // Convert back to UTC for storage
  return fromZonedTime(scheduledTime, GABON_TZ)
}

interface PriorityScore {
  orderId: string
  score: number
  agentId?: string
  isBlacklisted?: boolean
  isPriority?: boolean
}

/**
 * Intelligent 6-Level Priority Queue Scoring System
 *
 * Priority Rules:
 * 1. Base: Assign to online agent with lowest current workload
 * 2. Customer has historical delivery rate > 60% (+500)
 * 3. Order has highest product count (bundle/consolidated) (+100 per item)
 * 4. Oldest order (by createdAt) (+1 per minute old)
 * 5. Order status is DOUBLE (-1000)
 * 6. Phone number is blacklisted (-2000)
 *
 * @param parentSellerId - If provided, filter orders to only this seller (for sub-users)
 */
export async function getPriorityQueue(parentSellerId?: string | null): Promise<PriorityScore[]> {
  const now = new Date()
  const fiveMinsAgo = new Date(now.getTime() - 5 * 60000)

  const whereClause: any = {
    OR: [
      { status: { in: ['CALLBACK', 'NO_ANSWER', 'BUSY'] }, scheduledCallAt: { lte: now } },
      { status: 'NEW' },
      { status: 'POSTPONED' }
    ],
    // Exclude orders locked by another agent in last 5 mins
    NOT: {
      lockedByAgentId: { not: null },
      lockedAt: { gte: fiveMinsAgo }
    }
  }

  // NOTE: parentSellerId is NOT used for CALL_CENTER role
  // Unified Agent View: agents see all sellers' eligible orders regardless of parentSellerId

  const orders = await db.order.findMany({
    where: whereClause,
    select: {
      id: true,
      phone: true,
      status: true,
      createdAt: true,
      scheduledCallAt: true,
      bundleGroupId: true,
      seller: { select: { id: true, name: true } },
      items: {
        select: {
          productId: true,
          product: { select: { id: true, name: true } }
        }
      }
    }
  })

  const phones = Array.from(new Set(orders.map((order) => order.phone)))
  const [customers, blacklists] = await Promise.all([
    db.customer.findMany({
      where: { phone: { in: phones } },
      select: { phone: true, deliveryRate: true }
    }),
    db.blacklist.findMany({
      where: { phone: { in: phones }, isActive: true },
      select: { phone: true }
    })
  ])

  const customerRateMap = new Map(customers.map((customer) => [customer.phone, customer.deliveryRate]))
  const blacklistSet = new Set(blacklists.map((entry) => entry.phone))

  // Get all online CALL_CENTER agents
  const agents = await db.user.findMany({
    where: {
      role: 'CALL_CENTER',
      isActive: true,
      agentSession: {
        lastSeen: { gte: new Date(now.getTime() - 300000) } // Online within 5 minutes
      }
    },
    select: {
      id: true,
      agentSession: { select: { lastSeen: true } }
    }
  })

  // Pre-fetch some aggregated context for NEW scoring
  const workloads = await Promise.all(
    agents.map(async (agent) => {
      const count = await db.order.count({
        where: { assignedAgentId: agent.id, status: 'NEW' }
      })
      return { agentId: agent.id, count }
    })
  )

  const sortedAgents = [...agents].sort((a, b) => {
    const workloadA = workloads.find(w => w.agentId === a.id)?.count ?? 999
    const workloadB = workloads.find(w => w.agentId === b.id)?.count ?? 999
    return workloadA - workloadB
  })
  const lightestAgent = sortedAgents[0]

  const scoredOrders = sortQueueByPriority(
    orders.map((order) => ({
      id: order.id,
      phone: order.phone,
      status: order.status,
      createdAt: order.createdAt,
      scheduledCallAt: order.scheduledCallAt,
      customerDeliveryRate: customerRateMap.get(order.phone) ?? 0,
      itemCount: order.items.length,
      bundleGroupId: order.bundleGroupId,
      isBlacklisted: blacklistSet.has(order.phone)
    })),
    now
  )

  return scoredOrders.map((order) => ({
    orderId: order.id,
    score: order.score,
    agentId: lightestAgent?.id,
    isBlacklisted: order.isBlacklisted,
    isPriority: order.isPriority
  }))
}

/**
 * Soft-lock an order for a specific agent for 5 minutes.
 * Returns false if already locked by another agent whose lock has not expired.
 */
export async function softLockOrder(orderId: string, agentId: string): Promise<boolean> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { lockedByAgentId: true, lockedAt: true }
  })

  if (!order) return false

  const now = new Date()
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000)

  // If locked by a DIFFERENT agent within the last 5 min → reject
  if (
    order.lockedByAgentId &&
    order.lockedByAgentId !== agentId &&
    order.lockedAt &&
    order.lockedAt > fiveMinAgo
  ) {
    return false
  }

  await db.order.update({
    where: { id: orderId },
    data: { lockedByAgentId: agentId, lockedAt: now }
  })

  return true
}

/**
 * Release soft lock on an order (called after action is taken or timeout).
 */
export async function releaseLock(orderId: string): Promise<void> {
  await db.order.update({
    where: { id: orderId },
    data: { lockedByAgentId: null, lockedAt: null }
  })
}

/**
 * Assign order to an agent using priority queue
 */
export async function autoAssignOrder(orderId: string, parentSellerId?: string | null): Promise<string | null> {
  const scoredOrders = await getPriorityQueue(parentSellerId)

  // Find the order and its suggested agent
  const scoredOrder = scoredOrders.find(o => o.orderId === orderId)
  if (!scoredOrder || !scoredOrder.agentId) {
    // Fallback to simple assignment if no priority agent available
    return null
  }

  // Assign to the priority agent
  await db.order.update({
    where: { id: orderId },
    data: { assignedAgentId: scoredOrder.agentId }
  })

  return scoredOrder.agentId
}

/**
 * Get live call center stats per agent for admin overview.
 */
export async function getAgentStats() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const agents = await db.user.findMany({
    where: { role: 'CALL_CENTER', isActive: true },
    select: { id: true, name: true, email: true, agentSession: { select: { isOnline: true } } }
  })

  const stats = await Promise.all(agents.map(async (agent) => {
    const [assigned, resolved, confirmed, cancelled, callsMade] = await Promise.all([
      db.order.count({ where: { assignedAgentId: agent.id, status: 'NEW' } }),
      db.order.count({
        where: {
          assignedAgentId: agent.id,
          status: { in: ['CONFIRMED', 'CANCELLED'] },
          updatedAt: { gte: today }
        }
      }),
      db.order.count({
        where: {
          assignedAgentId: agent.id,
          history: { some: { changedById: agent.id, newStatus: 'CONFIRMED', createdAt: { gte: today } } }
        }
      }),
      db.callLog.count({ where: { agentId: agent.id, createdAt: { gte: today } } })
    ])
    return {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      isOnline: agent.agentSession?.isOnline ?? false,
      pendingLeads: assigned,
      resolvedToday: resolved,
      confirmedToday: confirmed,
      cancelledToday: cancelled,
      callsMadeToday: callsMade
    }
  }))

  return stats
}
