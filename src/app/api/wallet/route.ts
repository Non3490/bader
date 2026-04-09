import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureWallet } from '@/lib/wallet-service'

// GET /api/wallet — seller's own wallet summary
export async function GET() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const wallet = await ensureWallet(user.id)

    const transactions = await db.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    const withdrawals = await db.withdrawalRequest.findMany({
      where: { walletId: wallet.id },
      orderBy: { requestedAt: 'desc' },
      take: 20
    })

    return NextResponse.json({ wallet, transactions, withdrawals })
  } catch (error) {
    console.error('Wallet GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
