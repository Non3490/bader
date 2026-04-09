import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

// GET /api/warehouses
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'

    const warehouses = await db.warehouse.findMany({
      where: (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && !includeInactive ? { isActive: true } : undefined,
      include: {
        stocks: {
          select: {
            id: true,
            quantity: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      warehouses: warehouses.map(wh => ({
        ...wh,
        stockCount: wh.stocks.length,
        totalStock: wh.stocks.reduce((sum, s) => sum + s.quantity, 0),
      })),
    })
  } catch (error) {
    console.error('Warehouses GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/warehouses
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { name, city, address } = body

    if (!name || !city) {
      return NextResponse.json({ error: 'Name and city are required' }, { status: 400 })
    }

    const warehouse = await db.warehouse.create({
      data: { name, city, address },
    })

    await logActivity({
      userId: user.id,
      userRole: user.role,
      action: 'WAREHOUSE_CREATED',
      targetId: warehouse.id,
      description: `Created new warehouse: ${name} in ${city}`,
    })

    return NextResponse.json({ warehouse }, { status: 201 })
  } catch (error) {
    console.error('Warehouses POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
