import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { processWithdrawal, markWithdrawalAsPaid } from '@/lib/finance-service'

// PATCH /api/finance/withdrawals/[id] — Update withdrawal status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role === 'SELLER') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { action, note } = body

    if (action === 'approve' || action === 'reject') {
      const result = await processWithdrawal(params.id, action, user.id, note)
      return NextResponse.json(result)
    }

    if (action === 'mark-paid') {
      const result = await markWithdrawalAsPaid(params.id)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Withdrawal PATCH error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
