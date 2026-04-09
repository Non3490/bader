import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/wallet/all — admin sees all wallets
export async function GET() {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const wallets = await db.wallet.findMany({
      include: {
        seller: { select: { id: true, name: true, email: true } },
        withdrawals: { where: { status: 'PENDING' }, select: { id: true, amount: true } }
      },
      orderBy: { balance: 'desc' }
    })

    return NextResponse.json({
      wallets: wallets.map(w => ({
        id: w.id,
        sellerId: w.sellerId,
        seller: w.seller,
        balance: w.balance,
        totalEarned: w.totalEarned,
        totalDeducted: w.totalDeducted,
        pendingWithdrawals: w.withdrawals.length,
        pendingAmount: w.withdrawals.reduce((s, r) => s + r.amount, 0),
        updatedAt: w.updatedAt
      }))
    })
  } catch (error) {
    console.error('Wallets all error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
