import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

interface LatLng {
  lat: number
  lng: number
}

// GET /api/admin/delivery-zones - List all delivery zones
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const zones = await db.deliveryZone.findMany({
      include: {
        driver: {
          select: { id: true, name: true, phone: true }
        },
        _count: {
          select: { orders: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({
      zones: zones.map(zone => ({
        id: zone.id,
        name: zone.name,
        driver: zone.driver,
        driverId: zone.driverId,
        polygon: zone.polygon as LatLng[],
        orderCount: zone._count.orders,
        createdAt: zone.createdAt.toISOString(),
        updatedAt: zone.updatedAt.toISOString()
      }))
    })
  } catch (error) {
    console.error('Get delivery zones error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/delivery-zones - Create new delivery zone
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { name, driverId, polygon } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Zone name is required' }, { status: 400 })
    }

    if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
      return NextResponse.json(
        { error: 'Polygon must have at least 3 points' },
        { status: 400 }
      )
    }

    // Validate polygon format
    const isValidPolygon = polygon.every(
      (p: any) => typeof p.lat === 'number' && typeof p.lng === 'number'
    )

    if (!isValidPolygon) {
      return NextResponse.json(
        { error: 'Invalid polygon format. Each point must have lat and lng properties' },
        { status: 400 }
      )
    }

    // Check if zone name already exists
    const existingZone = await db.deliveryZone.findUnique({
      where: { name: name.trim() }
    })

    if (existingZone) {
      return NextResponse.json(
        { error: 'Zone with this name already exists' },
        { status: 409 }
      )
    }

    const zone = await db.deliveryZone.create({
      data: {
        name: name.trim(),
        polygon: polygon as any,
        driverId: driverId || null
      },
      include: {
        driver: {
          select: { id: true, name: true, phone: true }
        },
        _count: {
          select: { orders: true }
        }
      }
    })

    await logActivity(
      user.id,
      user.role,
      'DELIVERY_ZONE_CREATED',
      `Delivery zone "${name}" created`
    )

    return NextResponse.json(
      {
        zone: {
          id: zone.id,
          name: zone.name,
          driver: zone.driver,
          driverId: zone.driverId,
          polygon: zone.polygon as LatLng[],
          orderCount: zone._count.orders,
          createdAt: zone.createdAt.toISOString(),
          updatedAt: zone.updatedAt.toISOString()
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create delivery zone error:', error)
    return NextResponse.json({ error: 'Failed to create delivery zone' }, { status: 500 })
  }
}

// PUT /api/admin/delivery-zones - Update delivery zone
export async function PUT(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, driverId, polygon } = body

    if (!id) {
      return NextResponse.json({ error: 'Zone ID is required' }, { status: 400 })
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Zone name is required' }, { status: 400 })
    }

    if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
      return NextResponse.json(
        { error: 'Polygon must have at least 3 points' },
        { status: 400 }
      )
    }

    // Validate polygon format
    const isValidPolygon = polygon.every(
      (p: any) => typeof p.lat === 'number' && typeof p.lng === 'number'
    )

    if (!isValidPolygon) {
      return NextResponse.json(
        { error: 'Invalid polygon format. Each point must have lat and lng properties' },
        { status: 400 }
      )
    }

    // Check if another zone has the same name
    const existingZone = await db.deliveryZone.findFirst({
      where: {
        name: name.trim(),
        id: { not: id }
      }
    })

    if (existingZone) {
      return NextResponse.json(
        { error: 'Zone with this name already exists' },
        { status: 409 }
      )
    }

    const zone = await db.deliveryZone.update({
      where: { id },
      data: {
        name: name.trim(),
        polygon: polygon as any,
        driverId: driverId || null
      },
      include: {
        driver: {
          select: { id: true, name: true, phone: true }
        },
        _count: {
          select: { orders: true }
        }
      }
    })

    await logActivity(
      user.id,
      user.role,
      'DELIVERY_ZONE_UPDATED',
      `Delivery zone "${name}" updated`
    )

    return NextResponse.json({
      zone: {
        id: zone.id,
        name: zone.name,
        driver: zone.driver,
        driverId: zone.driverId,
        polygon: zone.polygon as LatLng[],
        orderCount: zone._count.orders,
        createdAt: zone.createdAt.toISOString(),
        updatedAt: zone.updatedAt.toISOString()
      }
    })
  } catch (error) {
    console.error('Update delivery zone error:', error)
    return NextResponse.json({ error: 'Failed to update delivery zone' }, { status: 500 })
  }
}
