import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureWallet } from '@/lib/wallet-service'
import { processWithdrawal, markWithdrawalAsPaid } from '@/lib/finance-service'

// GET /api/finance/withdrawals — List withdrawals
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const sellerId = searchParams.get('sellerId')

    let where: any = {}

    if (user.role === 'SELLER') {
      where.wallet = { sellerId: user.id }
    } else if (sellerId) {
      where.wallet = { sellerId }
    }

    if (status) {
      where.status = status
    }

    const withdrawals = await db.withdrawalRequest.findMany({
      where,
      include: {
        wallet: {
          include: {
            seller: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      },
      orderBy: { requestedAt: 'desc' },
      take: 50
    })

    return NextResponse.json(withdrawals)
  } catch (error) {
    console.error('Withdrawals GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/finance/withdrawals — Create withdrawal request (sellers only)
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Only sellers can request withdrawals' }, { status: 403 })
    }

    const body = await request.json()
    const { amount, method, account } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const wallet = await ensureWallet(user.id)

    if (wallet.balance < amount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }

    const withdrawal = await db.withdrawalRequest.create({
      data: {
        walletId: wallet.id,
        amount: parseFloat(amount),
        method: method || 'MOBILE_MONEY',
        account: account || '',
        status: 'PENDING'
      }
    })

    return NextResponse.json(withdrawal)
  } catch (error) {
    console.error('Withdrawals POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
