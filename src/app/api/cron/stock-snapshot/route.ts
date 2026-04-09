import { NextResponse } from 'next/server'
import { createDailySnapshots } from '@/lib/stock-snapshot'

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET || 'cron-secret-key-2024'

// POST /api/cron/stock-snapshot
export async function POST(request: NextRequest) {
  try {
    // Authenticate cron request
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${CRON_SECRET}`

    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Cron] Starting daily stock snapshot...')

    const result = await createDailySnapshots()

    console.log(`[Cron] Stock snapshot completed: ${result.count} products`)

    if (result.errors && result.errors.length > 0) {
      console.error(`[Cron] Snapshot errors:`, result.errors)
    }

    return NextResponse.json({
      success: result.success,
      count: result.count,
      errors: result.errors,
    })
  } catch (error) {
    console.error('[Cron] Stock snapshot error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
