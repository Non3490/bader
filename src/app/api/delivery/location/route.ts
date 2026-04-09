import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

// POST /api/delivery/location - Update driver's GPS location
export async function POST(request: Request) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'DELIVERY') {
      return NextResponse.json({ error: 'Delivery men only' }, { status: 403 })
    }

    const body = await request.json()
    const { lat, lng, address, accuracy } = body

    // Validate coordinates
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'Coordinates out of range' }, { status: 400 })
    }

    // Create new location record (old records will be cleaned up by periodic job)
    await db.deliveryLocation.create({
      data: {
        driverId: user.id,
        lat,
        lng,
        address: address || null,
        accuracy: accuracy || null
      }
    })

    // Clean up old locations (keep only last 100 per driver)
    const oldLocations = await db.deliveryLocation.findMany({
      where: { driverId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: 100,
      select: { id: true }
    })

    if (oldLocations.length > 0) {
      await db.deliveryLocation.deleteMany({
        where: {
          id: { in: oldLocations.map(l => l.id) }
        }
      })
    }

    return NextResponse.json({ success: true, message: 'Location updated' })
  } catch (error) {
    console.error('Update location error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update location' },
      { status: 500 }
    )
  }
}

// GET /api/delivery/location - Get nearby drivers for an address
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const address = searchParams.get('address')
    const city = searchParams.get('city')
    const zoneId = searchParams.get('zoneId')
    const limit = parseInt(searchParams.get('limit') || '5', 10)

    if (!address || !city) {
      return NextResponse.json({ error: 'Address and city are required' }, { status: 400 })
    }

    // Import here to avoid circular dependency
    const { findNearestDrivers } = await import('@/lib/delivery-assign')

    const result = await findNearestDrivers(
      address,
      city,
      zoneId,
      Math.min(limit, 10)
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get nearby drivers error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to find drivers' },
      { status: 500 }
    )
  }
}
