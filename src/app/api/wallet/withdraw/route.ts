import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureWallet } from '@/lib/wallet-service'
import { logActivity } from '@/lib/activity-logger'

// POST /api/wallet/withdraw — seller requests withdrawal
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { amount, note } = await request.json()
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const wallet = await ensureWallet(user.id)
    if (wallet.balance < amount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }

    // Check no pending withdrawal
    const pending = await db.withdrawalRequest.findFirst({
      where: { walletId: wallet.id, status: 'PENDING' }
    })
    if (pending) {
      return NextResponse.json({ error: 'You already have a pending withdrawal request' }, { status: 409 })
    }

    const withdrawal = await db.withdrawalRequest.create({
      data: { walletId: wallet.id, amount, note: note || null }
    })

    logActivity(user.id, user.role, 'WITHDRAWAL_REQUESTED', `Amount: ${amount}`).catch(() => {})

    return NextResponse.json({ withdrawal }, { status: 201 })
  } catch (error) {
    console.error('Withdraw error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
