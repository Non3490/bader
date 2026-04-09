import { NextResponse } from 'next/server'
import { endOfDay, startOfDay, subDays } from 'date-fns'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const user = await getSession()
    if (!user || user.role !== 'CALL_CENTER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const today = new Date()
    const todayStart = startOfDay(today)
    const todayEnd = endOfDay(today)
    const historyStart = startOfDay(subDays(today, 6))

    const expenses = await db.expense.findMany({
      where: {
        agentId: user.id,
        incurredAt: { gte: historyStart, lte: todayEnd }
      },
      include: {
        expenseType: { select: { id: true, name: true } }
      },
      orderBy: { incurredAt: 'desc' }
    })

    const todayExpenses = expenses.filter((expense) => expense.incurredAt >= todayStart)
    const historyMap = new Map<string, typeof expenses>()

    for (const expense of expenses) {
      const key = formatDateKey(expense.incurredAt)
      const group = historyMap.get(key) || []
      group.push(expense)
      historyMap.set(key, group)
    }

    const history = Array.from(historyMap.entries()).map(([date, entries]) => ({
      date,
      total: entries.reduce((sum, entry) => sum + entry.amount, 0),
      expenses: entries.map((expense) => ({
        id: expense.id,
        category: expense.expenseType?.name || expense.category,
        description: expense.description,
        amount: expense.amount,
        incurredAt: expense.incurredAt.toISOString(),
        canDelete: expense.incurredAt >= todayStart
      }))
    }))

    return NextResponse.json({
      today: {
        total: todayExpenses.reduce((sum, expense) => sum + expense.amount, 0),
        expenses: todayExpenses.map((expense) => ({
          id: expense.id,
          category: expense.expenseType?.name || expense.category,
          description: expense.description,
          amount: expense.amount,
          incurredAt: expense.incurredAt.toISOString(),
          canDelete: true
        }))
      },
      history
    })
  } catch (error) {
    console.error('My expenses error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatDateKey(value: Date) {
  return value.toISOString().slice(0, 10)
}
