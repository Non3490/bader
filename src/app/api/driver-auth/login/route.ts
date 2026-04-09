/**
 * Driver PIN Login API
 * POST /api/driver-auth/login
 * Body: { pin: string }
 * Returns: { success: boolean, driver?: DriverData, error?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPin, createDriverSession, setDriverSessionCookie, updateDriverLastSeen, isValidDriverStatusTransition } from '@/lib/driver-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pin, phone } = body

    // Validate PIN (4-6 digits)
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'Invalid PIN format. Must be 4-6 digits.' },
        { status: 400 }
      )
    }

    // Normalize phone: strip all spaces for comparison
    const normalizedInput = phone ? phone.replace(/\s/g, '') : null

    // Load all active drivers and match by normalized phone + PIN
    const allDrivers = await db.driver.findMany({ where: { isActive: true } })

    let driver = null
    for (const d of allDrivers) {
      // Normalize stored phone too before comparing
      const storedPhone = d.phone ? d.phone.replace(/\s/g, '') : ''
      if (normalizedInput && storedPhone !== normalizedInput) continue
      if (await verifyPin(pin, d.pin)) {
        driver = d
        break
      }
    }

    if (!driver) {
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 401 }
      )
    }

    // Update last seen
    await updateDriverLastSeen(driver.id)

    // If driver was OFFLINE, set to AVAILABLE (auto-start shift)
    if (driver.status === 'OFFLINE') {
      await db.driver.update({
        where: { id: driver.id },
        data: { status: 'AVAILABLE' }
      })
    }

    // Create session
    const token = await createDriverSession(driver.id)

    // Return driver data (without PIN) with session cookie
    const { pin: _, ...driverData } = driver
    const response = NextResponse.json({
      success: true,
      driver: driverData
    })

    response.cookies.set('driver_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/'
    })

    return response

  } catch (error) {
    console.error('Driver login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
