/**
 * Update Driver GPS Location
 * POST /api/driver/location
 * Body: { lat: number, lng: number, accuracy?: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireDriverAuth } from '@/lib/driver-auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const driver = await requireDriverAuth()
    const body = await request.json()
    const { lat, lng, accuracy } = body

    // Validate coordinates
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      )
    }

    // Update driver's last location
    await db.driver.update({
      where: { id: driver.id },
      data: {
        lastLocationLat: lat,
        lastLocationLng: lng,
        lastSeenAt: new Date()
      }
    })

    return NextResponse.json({ success: true })

  } catch (error: any) {
    if (error.message === 'DRIVER_NOT_AUTHENTICATED') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    console.error('Update location error:', error)
    return NextResponse.json(
      { error: 'Failed to update location' },
      { status: 500 }
    )
  }
}
