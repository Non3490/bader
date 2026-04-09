import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/stock-movements
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const stockId = request.nextUrl.searchParams.get('stockId')
    const where = stockId ? { stockId } : {}

    const movements = await db.stockMovement.findMany({
      where,
      include: {
        stock: {
          include: {
            product: { select: { name: true, sku: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return NextResponse.json({
      movements: movements.map(m => ({
        id: m.id,
        stockId: m.stockId,
        productName: m.stock.product.name,
        productSku: m.stock.product.sku,
        warehouse: m.stock.warehouse,
        quantity: m.quantity,
        type: m.type,
        reason: m.reason,
        createdAt: m.createdAt.toISOString()
      }))
    })
  } catch (error) {
    console.error('Stock movements GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/stock-movements
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json()
    const { stockId, type, quantity, reason } = body

    if (!stockId || !type || !quantity) {
      return NextResponse.json(
        { error: 'Missing required fields: stockId, type, quantity' },
        { status: 400 }
      )
    }

    const stock = await db.stock.findUnique({ where: { id: stockId } })
    if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 })

    // Check for OUT movements
    if ((type === 'OUT') && stock.quantity < parseInt(String(quantity))) {
      return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 })
    }

    const movement = await db.$transaction(async (tx) => {
      const delta = type === 'IN' || type === 'RETURN'
        ? parseInt(String(quantity))
        : -parseInt(String(quantity))

      const mov = await tx.stockMovement.create({
        data: { stockId, type, quantity: parseInt(String(quantity)), reason, userId: user.id }
      })

      await tx.stock.update({
        where: { id: stockId },
        data: { quantity: { increment: delta } }
      })

      return mov
    })

    return NextResponse.json({ movement }, { status: 201 })
  } catch (error) {
    console.error('Stock movements POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
