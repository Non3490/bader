import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  getFinanceOverview,
  getFinanceBySeller,
  getRemittanceLocks,
  getDeliveryFeeConfig,
  upsertDeliveryFeeConfig,
  getAgentExpenses,
  processWithdrawal,
  markWithdrawalAsPaid
} from '@/lib/finance-service'

// GET /api/finance — Finance overview & stats
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'
    const type = searchParams.get('type') || 'overview'

    if (type === 'by-seller' && user.role !== 'SELLER') {
      const bySeller = await getFinanceBySeller(period)
      return NextResponse.json(bySeller)
    }

    const overview = await getFinanceOverview(user.id, user.role, period)
    return NextResponse.json(overview)
  } catch (error) {
    console.error('Finance GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/finance — Create expense or other finance operations
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json()
    const { type, ...data } = body

    if (type === 'expense') {
      const expense = await db.expense.create({
        data: {
          sellerId: data.sellerId || (user.role === 'SELLER' ? user.id : null),
          agentId: data.agentId || null,
          category: data.category,
          amount: parseFloat(data.amount),
          description: data.description,
          incurredAt: data.date ? new Date(data.date) : new Date()
        }
      })
      return NextResponse.json(expense)
    }

    if (type === 'remittance-lock' && user.role !== 'SELLER') {
      const result = await getRemittanceLocks(data.deliveryManId)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error) {
    console.error('Finance POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
