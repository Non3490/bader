import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createDailySnapshots } from '@/lib/stock-snapshot'

// GET /api/stock/snapshot-trigger - Manually trigger daily snapshot creation (admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 401 })
    }

    const result = await createDailySnapshots()

    return NextResponse.json({
      success: result.success,
      count: result.count,
      message: `Created ${result.count} stock snapshots`,
      errors: result.errors,
    })
  } catch (error) {
    console.error('Snapshot trigger error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
