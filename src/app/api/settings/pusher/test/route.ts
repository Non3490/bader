import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import Pusher from 'pusher'

// POST /api/settings/pusher/test - Test Pusher connection
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { appId, key, secret, cluster } = body

    if (!appId || !key || !secret) {
      return NextResponse.json({
        success: false,
        message: 'Missing required credentials'
      }, { status: 400 })
    }

    // Create a temporary Pusher instance with the provided credentials
    const pusher = new Pusher({
      appId,
      key,
      secret,
      cluster: cluster || 'eu',
      useTLS: true,
    })

    try {
      // Test connection by triggering a test event
      await pusher.trigger('test-channel', 'test-event', {
        message: 'Connection test',
        timestamp: new Date().toISOString(),
      })

      return NextResponse.json({
        success: true,
        message: 'Successfully connected to Pusher and triggered test event'
      })
    } catch (pusherError) {
      return NextResponse.json({
        success: false,
        message: pusherError instanceof Error ? pusherError.message : 'Failed to connect to Pusher'
      })
    }
  } catch (error) {
    console.error('Pusher connection test error:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 })
  }
}
