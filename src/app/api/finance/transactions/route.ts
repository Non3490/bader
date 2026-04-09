import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/finance/transactions — Transaction history
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'
    const type = searchParams.get('type') // CREDIT | DEBIT | WITHDRAWAL | ADJUSTMENT

    const date = getDateFromPeriod(period)

    let where: any = {
      createdAt: { gte: date }
    }

    if (user.role === 'SELLER') {
      where.wallet = { sellerId: user.id }
    }

    if (type) {
      where.type = type
    }

    const transactions = await db.walletTransaction.findMany({
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
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    return NextResponse.json(transactions)
  } catch (error) {
    console.error('Transactions GET error:', error)
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
