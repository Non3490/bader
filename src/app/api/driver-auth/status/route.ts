/**
 * Update Driver Status
 * PUT /api/driver-auth/status
 * Body: { status: 'AVAILABLE' | 'ON_DELIVERY' | 'OFFLINE' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireDriverAuth, isValidDriverStatusTransition, updateDriverLastSeen } from '@/lib/driver-auth'
import { db } from '@/lib/db'

export async function PUT(request: NextRequest) {
  try {
    const driver = await requireDriverAuth()
    const body = await request.json()
    const { status, lat, lng } = body

    // Validate status
    const validStatuses = ['AVAILABLE', 'ON_DELIVERY', 'OFFLINE']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Validate transition
    if (!isValidDriverStatusTransition(driver.status, status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${driver.status} to ${status}` },
        { status: 400 }
      )
    }

    // Update driver status and location
    const updatedDriver = await db.driver.update({
      where: { id: driver.id },
      data: {
        status,
        lastLocationLat: lat,
        lastLocationLng: lng,
        lastSeenAt: new Date()
      }
    })

    // Return updated driver data
    const { pin: _, ...driverData } = updatedDriver
    return NextResponse.json({ driver: driverData })

  } catch (error: any) {
    if (error.message === 'DRIVER_NOT_AUTHENTICATED') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    console.error('Update driver status error:', error)
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    )
  }
}
