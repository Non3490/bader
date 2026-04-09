/**
 * Driver Logout API
 * POST /api/driver-auth/logout
 */

import { NextResponse } from 'next/server'
import { clearDriverSession, requireDriverAuth } from '@/lib/driver-auth'
import { db } from '@/lib/db'

export async function POST() {
  try {
    const driver = await requireDriverAuth()

    // Set driver to OFFLINE when logging out (ending shift)
    await db.driver.update({
      where: { id: driver.id },
      data: { status: 'OFFLINE' }
    })

    // Clear session cookie
    const response = NextResponse.json({ success: true })
    response.cookies.delete('driver_session')
    return response

  } catch (error) {
    // Driver might not be authenticated, just clear the cookie anyway
    const response = NextResponse.json({ success: true })
    response.cookies.delete('driver_session')
    return response
  }
}
