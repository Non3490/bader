import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getAgentExpenses } from '@/lib/finance-service'

// GET /api/finance/agent-fees — List agent expenses
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const period = searchParams.get('period') || '30d'

    // Get agent expenses
    const expenses = await getAgentExpenses(agentId || undefined, period)

    // Get summary stats
    const summary = await db.expense.groupBy({
      by: ['agentId'],
      where: {
        agentId: { not: null },
        incurredAt: { gte: getDateFromPeriod(period) }
      },
      _sum: { amount: true }
    })

    const agentStats = summary.map(s => ({
      agentId: s.agentId,
      totalExpenses: s._sum.amount || 0
    }))

    // Get active call center agents
    const agents = await db.user.findMany({
      where: { role: 'CALL_CENTER', isActive: true },
      select: { id: true, name: true, email: true }
    })

    return NextResponse.json({ expenses, agentStats, agents })
  } catch (error) {
    console.error('Agent Fees GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/finance/agent-fees — Log agent expense
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json()
    const { agentId, type, amount, description, date } = body

    if (!agentId || !type || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Find or create the ExpenseType record for this type name
    let expenseTypeRecord = await db.expenseType.findFirst({
      where: { name: type, category: 'CALL_CENTER' }
    })
    if (!expenseTypeRecord) {
      expenseTypeRecord = await db.expenseType.create({
        data: { name: type, category: 'CALL_CENTER' }
      })
    }

    const expense = await db.expense.create({
      data: {
        agentId,
        category: 'CALL_CENTER',
        expenseTypeId: expenseTypeRecord.id,
        amount: parseFloat(amount),
        description,
        incurredAt: date ? new Date(date) : new Date()
      }
    })

    return NextResponse.json(expense)
  } catch (error) {
    console.error('Agent Fees POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getDateFromPeriod(period: string): Date {
  const now = new Date()
  switch (period) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}
