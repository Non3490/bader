import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// GET /api/finance/invoices — List invoices
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('sellerId')
    const deliveryManId = searchParams.get('deliveryManId')
    const cycleType = searchParams.get('cycleType') // SELLER | DELIVERY

    let where: any = {}

    if (user.role === 'SELLER') {
      where.sellerId = user.id
    } else if (sellerId) {
      where.sellerId = sellerId
    }

    if (deliveryManId) {
      where.deliveryManId = deliveryManId
    }

    if (cycleType) {
      where.cycleType = cycleType
    }

    const invoices = await db.invoice.findMany({
      where,
      include: {
        seller: { select: { id: true, name: true, email: true } },
        deliveryMan: { select: { id: true, name: true, email: true } },
        lineItems: true,
        remittanceLock: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Invoices GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
