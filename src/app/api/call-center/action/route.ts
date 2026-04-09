import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { runAutoFlagCheckAfterOrderUpdate } from '@/lib/blacklist-service'

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawBody = await request.text()
    let body: {
      orderId?: string
      action?: 'CONFIRM' | 'NO_ANSWER' | 'BUSY' | 'CALLBACK' | 'CANCEL'
      note?: string
      scheduledCallAt?: string
    } = {}

    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody)
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
      }
    }

    const { orderId, action, note, scheduledCallAt } = body as {
      orderId?: string
      action?: 'CONFIRM' | 'NO_ANSWER' | 'BUSY' | 'CALLBACK' | 'CANCEL'
      note?: string
      scheduledCallAt?: string
    }

    if (!orderId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        sellerId: true,
        phone: true,
        trackingNumber: true,
        callAttempts: true,
        assignedAgentId: true
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const statusMap = {
      CONFIRM: 'CONFIRMED',
      NO_ANSWER: 'NO_ANSWER',
      BUSY: 'BUSY',
      CALLBACK: 'CALLBACK',
      CANCEL: 'CANCELLED'
    } as const

    const attemptMap = {
      CONFIRM: 'ANSWERED',
      NO_ANSWER: 'NO_ANSWER',
      BUSY: 'BUSY',
      CALLBACK: 'CALLBACK',
      CANCEL: 'CANCELLED'
    } as const

    const nextStatus = statusMap[action]
    const nextAttempt = attemptMap[action]
    const nextAttempts =
      action === 'NO_ANSWER' || action === 'BUSY' || action === 'CALLBACK'
        ? (order.callAttempts || 0) + 1
        : order.callAttempts || 0

    const updateData: Record<string, unknown> = {
      status: nextStatus,
      note: note ?? null
    }

    if (action === 'CONFIRM') {
      updateData.confirmedAt = new Date()
      if (!order.assignedAgentId && user.role === 'CALL_CENTER') {
        updateData.assignedAgentId = user.id
      }
    }

    if (action === 'CANCEL') {
      updateData.cancelledAt = new Date()
    }

    if (action === 'NO_ANSWER' || action === 'BUSY') {
      updateData.callAttempts = nextAttempts
      const fallbackCallback = new Date()
      fallbackCallback.setMinutes(fallbackCallback.getMinutes() + (action === 'NO_ANSWER' ? 15 : 30))
      updateData.scheduledCallAt = fallbackCallback.toISOString()
    }

    if (action === 'CALLBACK') {
      updateData.callAttempts = nextAttempts
      updateData.scheduledCallAt = scheduledCallAt ? new Date(scheduledCallAt).toISOString() : null
    }

    if (action === 'CONFIRM' || action === 'CANCEL') {
      updateData.scheduledCallAt = null
    }

    await db.$transaction([
      db.callLog.create({
        data: {
          orderId: order.id,
          agentId: user.id,
          attempt: nextAttempt,
          comment: note ?? null
        }
      }),
      db.order.update({
        where: { id: order.id },
        data: {
          ...updateData,
          history: {
            create: {
              previousStatus: order.status,
              newStatus: nextStatus,
              changedById: user.id,
              note: note ?? null
            }
          }
        }
      })
    ])

    // Auto-flag customer if they meet blacklist criteria after CONFIRMED status
    if (action === 'CONFIRM') {
      const { flagged, metrics } = await runAutoFlagCheckAfterOrderUpdate(order.phone)
      if (flagged && metrics) {
        // Log for admin visibility
        await db.activityLog.create({
          data: {
            userId: user.id,
            role: user.role,
            action: 'BLACKLIST_AUTO_FLAGGED',
            details: `🚫 Auto-flagged ${order.phone}: ${metrics.totalOrders} orders, ${metrics.confirmationRate}% confirm rate, ${metrics.deliveryRate}% delivery rate. Last order: ${order.trackingNumber} → ${nextStatus}`
          }
        }).catch(err => console.error('Failed to log auto-flag:', err))
      }
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      trackingNumber: order.trackingNumber,
      status: nextStatus
    })
  } catch (error) {
    console.error('Call center action error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
