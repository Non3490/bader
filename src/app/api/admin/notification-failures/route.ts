import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, checkPermission } from '@/lib/admin-auth'
import {
  getFailedNotifications,
  getFailedNotificationStats,
  manualRetry,
  cleanupOldFailedNotifications
} from '@/lib/notification-retry'

// GET /api/admin/notification-failures - Get failed notifications with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = checkPermission(session.role as any, 'notifications:configure')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const channel = searchParams.get('channel')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Check if stats are requested
    const stats = searchParams.get('stats') === 'true'

    if (stats) {
      const notificationStats = await getFailedNotificationStats()
      return NextResponse.json({ stats: notificationStats })
    }

    const result = await getFailedNotifications({
      channel: channel || undefined,
      status: status || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      offset
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get failed notifications error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/notification-failures - Actions (retry, cleanup)
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = checkPermission(session.role as any, 'notifications:configure')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { action, notificationId } = body

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'retry':
        if (!notificationId) {
          return NextResponse.json(
            { error: 'notificationId is required for retry' },
            { status: 400 }
          )
        }

        const retryResult = await manualRetry(notificationId)
        return NextResponse.json(retryResult)

      case 'cleanup':
        const olderThanDays = body.olderThanDays || 30
        const deletedCount = await cleanupOldFailedNotifications(olderThanDays)
        return NextResponse.json({
          success: true,
          deleted: deletedCount,
          message: `Deleted ${deletedCount} old notifications`
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Failed notifications action error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
