/**
 * Get Current Driver Session
 * GET /api/driver-auth/me
 */

import { NextResponse } from 'next/server'
import { getDriverSession } from '@/lib/driver-auth'

export async function GET() {
  try {
    const driver = await getDriverSession()

    if (!driver) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json({ driver })

  } catch (error) {
    console.error('Get driver session error:', error)
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    )
  }
}
