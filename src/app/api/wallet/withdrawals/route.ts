import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

// GET /api/wallet/withdrawals — admin sees all pending withdrawal requests
export async function GET() {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const withdrawals = await db.withdrawalRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        wallet: {
          include: { seller: { select: { id: true, name: true, email: true } } }
        }
      },
      orderBy: { requestedAt: 'asc' }
    })

    return NextResponse.json({ withdrawals })
  } catch (error) {
    console.error('Withdrawals GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/wallet/withdrawals — admin processes a withdrawal
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { id, status, note } = await request.json()
    if (!id || !['APPROVED', 'REJECTED', 'PAID'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const withdrawal = await db.withdrawalRequest.findUnique({ where: { id }, include: { wallet: true } })
    if (!withdrawal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await db.withdrawalRequest.update({
      where: { id },
      data: { status, note: note || null, processedAt: new Date(), processedBy: user.id }
    })

    // If approved/paid, deduct from wallet balance
    if (status === 'PAID') {
      await db.wallet.update({
        where: { id: withdrawal.walletId },
        data: { balance: { decrement: withdrawal.amount }, totalDeducted: { increment: withdrawal.amount } }
      })
      await db.walletTransaction.create({
        data: {
          walletId: withdrawal.walletId,
          type: 'WITHDRAWAL',
          amount: withdrawal.amount,
          description: `Withdrawal processed by admin`
        }
      })
    }

    logActivity(user.id, user.role, 'WITHDRAWAL_PROCESSED', `${status} — amount: ${withdrawal.amount}`).catch(() => {})

    return NextResponse.json({ withdrawal: updated })
  } catch (error) {
    console.error('Withdrawals PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
