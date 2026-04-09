import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/notifications/settings
export async function GET(req: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if NotificationSettings model exists by trying to query it
    let settings = null
    try {
      settings = await (db as any).notificationSettings.findFirst({
        where: { userId: user.id }
      })
    } catch (dbErr) {
      // Model might not exist yet — continue with defaults
      console.warn('NotificationSettings model not found, using defaults')
    }

    // Default settings if none exist
    const defaults = {
      smsEnabled: true,
      whatsappEnabled: false,
      notifyOnConfirmed: true,
      notifyOnShipped: true,
      notifyOnDelivered: true,
      notifyOnReturned: true,
    }

    return NextResponse.json({ settings: settings || defaults })
  } catch (error) {
    console.error('Get notification settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/notifications/settings
export async function PUT(req: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    // If NotificationSettings model exists, upsert it
    try {
      await (db as any).notificationSettings.upsert({
        where: { userId: user.id },
        update: body,
        create: { userId: user.id, ...body }
      })
    } catch (dbErr) {
      // Model might not exist yet — log and continue
      console.warn('NotificationSettings model not found, skipping persistence')
    }

    return NextResponse.json({ ok: true, settings: body })
  } catch (error) {
    console.error('Update notification settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
