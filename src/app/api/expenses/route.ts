import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { scopeByRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { debitWallet } from '@/lib/wallet-service'
import { logActivity } from '@/lib/activity-logger'

// GET /api/expenses
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')

    // Build where clause based on role
    let whereClause: Record<string, unknown> = {}

    if (user.role === 'CALL_CENTER') {
      // Call center agents see their own expenses
      whereClause.agentId = user.id
    } else if (user.role === 'ADMIN') {
      // Admin sees all expenses
      // No filter needed
    } else {
      // SELLER sees only their expenses
      whereClause.sellerId = user.id
    }

    const expenses = await db.expense.findMany({
      where: whereClause,
      include: {
        order: { select: { id: true, trackingNumber: true, recipientName: true } },
        seller: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true } }
      },
      orderBy: { incurredAt: 'desc' },
      take: limit
    })

    return NextResponse.json({
      expenses: expenses.map(e => ({
        id: e.id,
        category: e.category,
        amount: e.amount,
        description: e.description,
        orderId: e.orderId,
        order: e.order,
        incurredAt: e.incurredAt.toISOString()
      }))
    })
  } catch (error) {
    console.error('Expenses GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/expenses
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json()
    const { category, amount, description, orderId, incurredAt, expenseTypeId } = body

    if (!category || !amount) {
      return NextResponse.json({ error: 'Missing required fields: category, amount' }, { status: 400 })
    }

    const parsedAmount = parseFloat(String(amount))
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
    }

    // Create expense data - sellerId for SELLER, agentId for CALL_CENTER
    let expenseData: {
      sellerId?: string
      agentId?: string
      category: string
      amount: number
      description?: string | null
      orderId?: string | undefined
      expenseTypeId?: string | undefined
      incurredAt: Date
    } = {
      category,
      amount: parseFloat(String(amount)),
      description,
      orderId: orderId || undefined,
      incurredAt: incurredAt ? new Date(incurredAt) : new Date(),
      expenseTypeId: expenseTypeId || undefined
    }

    if (user.role === 'CALL_CENTER') {
      expenseData.agentId = user.id
    } else {
      expenseData.sellerId = user.id
    }

    const expense = await db.expense.create({
      data: expenseData
    }).catch((err) => {
      console.error('[EXPENSE CREATE] Failed to create expense:', JSON.stringify(expenseData, null, 2), err)
      throw err
    })

    // Only debit wallet for SELLER expenses, not CALL_CENTER
    if (user.role !== 'CALL_CENTER') {
      const effectiveSellerId = user.id
      debitWallet(effectiveSellerId, parseFloat(String(amount)), description || category, orderId || undefined).catch(() => {})
    }

    logActivity(user.id, user.role, 'EXPENSE_CREATED', `${category} — ${amount}`).catch(() => {})

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error) {
    console.error('Expenses POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
