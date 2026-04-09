import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * Get Gabon midnight (UTC+1) for the current day
 * Returns the UTC timestamp that represents midnight in Gabon
 */
function getGabonMidnight(): Date {
  const now = new Date()
  // Get current UTC time
  const utcNow = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  )

  // Gabon is UTC+1, so midnight Gabon time is 23:00 UTC the previous day
  // We need to find the most recent 23:00 UTC
  const utcHours = now.getUTCHours()
  const gabonOffset = 1 // UTC+1

  // Calculate today's midnight in Gabon (which is 23:00 UTC previous day for gte filtering)
  const gabonMidnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    gabonOffset - 1, // 23:00 UTC = midnight Gabon next day, but we want start of day
    0,
    0,
    0
  ))

  // If current UTC time is before 23:00, use previous day's 23:00
  if (utcHours < 23) {
    gabonMidnight.setUTCDate(gabonMidnight.getUTCDate() - 1)
  }

  return gabonMidnight
}

/**
 * GET /api/call-center/performance
 * Get call center agent performance metrics
 * ADMIN only
 */
export async function GET(request: NextRequest) {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period')
    const agentId = searchParams.get('agentId')

    // If period is 'today', use Gabon midnight (UTC+1)
    const isTodayMode = period === 'today'
    const startDate = isTodayMode ? getGabonMidnight() : (() => {
      const days = parseInt(period || '7')
      const date = new Date()
      date.setDate(date.getDate() - days)
      date.setHours(0, 0, 0, 0)
      return date
    })()

    const agents = await db.user.findMany({
      where: { role: 'CALL_CENTER', isActive: true },
      select: { id: true, name: true, createdAt: true }
    })

    const performance = await Promise.all(
      agents.map(async (agent) => {
        // Get call logs for this agent within the period
        const callLogs = await db.callLog.findMany({
          where: {
            agentId: agent.id,
            createdAt: { gte: startDate }
          }
        })

        const orderIds = callLogs.map(c => c.orderId)
        const orders = await db.order.findMany({
          where: { id: { in: orderIds } }
        })

        const confirmed = orders.filter(o => o.status === 'CONFIRMED').length
        const cancelled = orders.filter(o => o.status === 'CANCELLED').length
        const noAnswer = callLogs.filter(c => c.comment === 'NO_ANSWER').length
        const busy = callLogs.filter(c => c.comment === 'BUSY').length
        const wrongNumber = callLogs.filter(c => c.comment === 'WRONG_NUMBER').length

        // Calculate confirmation rate
        const confirmationRate = orders.length > 0
          ? (confirmed / orders.length * 100).toFixed(1)
          : '0.0'

        // Calculate average calls per hour
        // For 'today' mode, calculate hours since midnight Gabon time
        const periodDays = isTodayMode ? 1 : (parseInt(period || '7'))
        const totalHours = isTodayMode
          ? Math.max(1, Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60)))
          : periodDays * 8
        const avgCallsPerHour = totalHours > 0
          ? (callLogs.length / totalHours).toFixed(1)
          : '0.0'

        return {
          agent,
          stats: {
            totalCalls: callLogs.length,
            uniqueOrders: orders.length,
            confirmed,
            cancelled,
            noAnswer,
            busy,
            wrongNumber,
            confirmationRate,
            avgCallsPerHour,
            callRate: periodDays > 0 ? (callLogs.length / periodDays).toFixed(1) : '0.0'
          }
        }
      })
    )

    // Sort by total calls descending
    performance.sort((a, b) => b.stats.totalCalls - a.stats.totalCalls)

    return NextResponse.json({
      data: performance,
      period: isTodayMode ? 'today' : (period || '7'),
      startDate,
      summary: {
        totalAgents: performance.length,
        totalCalls: performance.reduce((sum, p) => sum + p.stats.totalCalls, 0),
        totalConfirmed: performance.reduce((sum, p) => sum + p.stats.confirmed, 0),
        totalCancelled: performance.reduce((sum, p) => sum + p.stats.cancelled, 0),
        avgConfirmationRate: performance.length > 0
          ? (performance.reduce((sum, p) => sum + parseFloat(p.stats.confirmationRate as string), 0) / performance.length).toFixed(1)
          : '0.0'
      }
    })
  } catch (error) {
    console.error('Error fetching call center performance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
