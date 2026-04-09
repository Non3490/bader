import { NextResponse } from 'next/server'
import { eachDayOfInterval, endOfDay, format, startOfDay, subDays } from 'date-fns'
import { getSession } from '@/lib/auth'
import { getAgentStats } from '@/lib/agent-stats'

function pctChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100
  }
  return Math.round(((current - previous) / previous) * 100)
}

async function getDayStats(agentId: string, day: Date) {
  const from = startOfDay(day)
  const to = endOfDay(day)
  const stats = await getAgentStats(agentId, from, to)
  return {
    calls: stats.totalCalls,
    confirmed: stats.confirmed,
    cancelled: stats.cancelled,
    rate: stats.confirmRate,
  }
}

export async function GET() {
  try {
    const user = await getSession()
    if (!user || user.role !== 'CALL_CENTER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const today = new Date()
    const yesterday = subDays(today, 1)
    const last7Start = subDays(today, 6)

    const [todayStats, yesterdayStats] = await Promise.all([
      getDayStats(user.id, today),
      getDayStats(user.id, yesterday)
    ])

    const days = eachDayOfInterval({ start: last7Start, end: today })
    const last7 = await Promise.all(days.map((day) => getDayStats(user.id, day)))
    const total7 = last7.reduce((acc, item) => ({
      calls: acc.calls + item.calls,
      confirmed: acc.confirmed + item.confirmed,
      rate: acc.rate + item.rate
    }), { calls: 0, confirmed: 0, rate: 0 })

    const bestDayEntry = last7
      .map((stats, index) => ({ stats, day: days[index] }))
      .sort((a, b) => b.stats.calls - a.stats.calls)[0]

    return NextResponse.json({
      todayVsYesterday: {
        today: todayStats,
        yesterday: yesterdayStats,
        change: {
          calls: pctChange(todayStats.calls, yesterdayStats.calls),
          confirmed: pctChange(todayStats.confirmed, yesterdayStats.confirmed),
          rate: pctChange(todayStats.rate, yesterdayStats.rate)
        }
      },
      average7d: {
        avgCallsPerDay: Math.round(total7.calls / last7.length),
        avgConfirmedPerDay: Math.round(total7.confirmed / last7.length),
        avgRate: Math.round(total7.rate / last7.length),
        bestDay: bestDayEntry
          ? { label: format(bestDayEntry.day, 'EEEE'), calls: bestDayEntry.stats.calls }
          : null
      }
    })
  } catch (error) {
    console.error('Agent performance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
