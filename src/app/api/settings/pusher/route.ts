import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/settings/pusher - Get Pusher settings
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get tenant settings
    const tenantSettings = await db.tenantSettings.findFirst({
      where: { users: { some: { id: user.id } } },
      select: {
        pusherAppId: true,
        pusherKey: true,
        pusherCluster: true,
        pusherChannel: true,
      }
    })

    // Return settings (secret is not exposed)
    if (tenantSettings) {
      return NextResponse.json({
        settings: {
          appId: tenantSettings.pusherAppId || '',
          key: tenantSettings.pusherKey || '',
          secret: '', // Never expose secret
          cluster: tenantSettings.pusherCluster || 'eu',
          channel: tenantSettings.pusherChannel || '',
        }
      })
    }

    // Return empty settings if not configured
    return NextResponse.json({
      settings: {
        appId: '',
        key: '',
        secret: '',
        cluster: 'eu',
        channel: '',
      }
    })
  } catch (error) {
    console.error('Get Pusher settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/settings/pusher - Update Pusher settings
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
    const { appId, key, secret, cluster, channel } = body

    if (!appId || !key || !secret) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Find or create tenant settings
    const tenantSettings = await db.tenantSettings.findFirst({
      where: { users: { some: { id: user.id } } }
    })

    if (tenantSettings) {
      // Update existing
      await db.tenantSettings.update({
        where: { id: tenantSettings.id },
        data: {
          pusherAppId: appId,
          pusherKey: key,
          pusherCluster: cluster || 'eu',
          pusherChannel: channel || null,
        }
      })
    } else {
      // Create new (this would need a proper tenant ID or first user association)
      // For now, update the first tenant settings or create a default one
      const firstSettings = await db.tenantSettings.findFirst()
      if (firstSettings) {
        await db.tenantSettings.update({
          where: { id: firstSettings.id },
          data: {
            pusherAppId: appId,
            pusherKey: key,
            pusherCluster: cluster || 'eu',
            pusherChannel: channel || null,
          }
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update Pusher settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
