import { db } from '@/lib/db'

export async function getAgentStats(agentId: string, from: Date, to: Date) {
  const [totalCalls, confirmed, cancelled] = await Promise.all([
    db.callLog.count({
      where: {
        agentId,
        createdAt: { gte: from, lte: to }
      }
    }),
    db.order.count({
      where: {
        history: {
          some: {
            changedById: agentId,
            newStatus: 'CONFIRMED',
            createdAt: { gte: from, lte: to }
          }
        }
      }
    }),
    db.order.count({
      where: {
        history: {
          some: {
            changedById: agentId,
            newStatus: 'CANCELLED',
            createdAt: { gte: from, lte: to }
          }
        }
      }
    })
  ])

  const confirmRate =
    confirmed + cancelled > 0
      ? Math.round((confirmed / (confirmed + cancelled)) * 100)
      : 0

  return {
    totalCalls,
    confirmed,
    cancelled,
    confirmRate,
  }
}
