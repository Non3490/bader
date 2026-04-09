import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/agents/cleanup
// Marks agents as offline if they haven't sent a heartbeat in 60+ seconds
// Runs via cron every minute
export async function GET(request: NextRequest) {
  try {
    // Optional: Protect with secret token for cron jobs
    const searchParams = request.nextUrl.searchParams
    const secret = searchParams.get('secret')
    const expectedSecret = process.env.CRON_SECRET

    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const cutoff = new Date(now.getTime() - 60000) // 60 seconds ago

    // Find and update agents who are marked as online but haven't sent a heartbeat recently
    const result = await db.agentSession.updateMany({
      where: {
        isOnline: true,
        lastSeen: {
          lt: cutoff
        }
      },
      data: {
        isOnline: false
      }
    })

    return NextResponse.json({
      success: true,
      markedOffline: result.count,
      timestamp: now.toISOString()
    })
  } catch (error) {
    console.error('Agent cleanup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
