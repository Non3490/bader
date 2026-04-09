import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

interface LatLng {
  lat: number
  lng: number
}

// GET /api/admin/delivery-zones/[id] - Get delivery zone by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const zone = await db.deliveryZone.findUnique({
      where: { id: params.id },
      include: {
        driver: {
          select: { id: true, name: true, phone: true }
        },
        orders: {
          select: {
            id: true,
            trackingNumber: true,
            recipientName: true,
            phone: true,
            address: true,
            city: true,
            codAmount: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
    }

    return NextResponse.json({
      zone: {
        id: zone.id,
        name: zone.name,
        driver: zone.driver,
        driverId: zone.driverId,
        polygon: zone.polygon as LatLng[],
        createdAt: zone.createdAt.toISOString(),
        updatedAt: zone.updatedAt.toISOString(),
        orders: zone.orders
      }
    })
  } catch (error) {
    console.error('Get delivery zone error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/delivery-zones/[id] - Delete delivery zone
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    // Check if zone exists and get its name for logging
    const zone = await db.deliveryZone.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { orders: true }
        }
      }
    })

    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
    }

    if (zone._count.orders > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete zone with assigned orders',
          ordersCount: zone._count.orders
        },
        { status: 409 }
      )
    }

    await db.deliveryZone.delete({
      where: { id: params.id }
    })

    await logActivity(
      user.id,
      user.role,
      'DELIVERY_ZONE_DELETED',
      `Delivery zone "${zone.name}" deleted`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete delivery zone error:', error)
    return NextResponse.json({ error: 'Failed to delete delivery zone' }, { status: 500 })
  }
}
