import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getOrderNotifications } from '@/lib/notifications'

/**
 * GET /api/notifications/log/[orderId]
 * Get notification logs for an order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'SELLER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { orderId } = await params

  try {
    // Check permissions - SELLERs can only see their own order notifications
    if (user.role === 'SELLER') {
      const order = await db.order.findUnique({
        where: { id: orderId },
        select: { sellerId: true }
      })

      if (!order || order.sellerId !== user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    const logs = await getOrderNotifications(orderId)

    return NextResponse.json({ data: logs })
  } catch (error) {
    console.error('Error fetching notification logs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
