import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

// GET /api/warehouses/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const warehouse = await db.warehouse.findUnique({
      where: { id: params.id },
      include: {
        stocks: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                seller: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    return NextResponse.json({ warehouse })
  } catch (error) {
    console.error('Warehouse GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/warehouses/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { name, city, address, isActive } = body

    const warehouse = await db.warehouse.findUnique({
      where: { id: params.id },
    })

    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (city !== undefined) updateData.city = city
    if (address !== undefined) updateData.address = address
    if (isActive !== undefined) updateData.isActive = isActive

    const updated = await db.warehouse.update({
      where: { id: params.id },
      data: updateData,
    })

    await logActivity({
      userId: user.id,
      userRole: user.role,
      action: 'WAREHOUSE_UPDATED',
      targetId: warehouse.id,
      description: `Updated warehouse ${warehouse.name}`,
    })

    return NextResponse.json({ warehouse: updated })
  } catch (error) {
    console.error('Warehouse PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/warehouses/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const warehouse = await db.warehouse.findUnique({
      where: { id: params.id },
    })

    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    // Soft delete - set isActive to false
    await db.warehouse.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    await logActivity({
      userId: user.id,
      userRole: user.role,
      action: 'WAREHOUSE_DEACTIVATED',
      targetId: warehouse.id,
      description: `Deactivated warehouse ${warehouse.name}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Warehouse DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
