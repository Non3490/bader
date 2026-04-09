import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/phone-calls/callbacks/[id]/complete - Mark callback as done
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Find the callback log
    const callback = await db.phoneCallLog.findUnique({
      where: { id }
    })

    if (!callback) {
      return NextResponse.json({ error: 'Callback not found' }, { status: 404 })
    }

    // Check if this callback belongs to the current agent or user is admin
    if (callback.agentId !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Mark as completed
    const updated = await db.phoneCallLog.update({
      where: { id },
      data: {
        callbackDone: true,
        callbackNeeded: false
      },
      include: {
        order: {
          select: {
            id: true,
            trackingNumber: true,
            status: true
          }
        }
      }
    })

    // Log the activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        role: user.role,
        action: 'CALLBACK_COMPLETED',
        details: JSON.stringify({
          callLogId: id,
          customerPhone: callback.customerPhone
        })
      }
    })

    return NextResponse.json({
      success: true,
      callback: {
        id: updated.id,
        customerPhone: updated.customerPhone,
        callType: updated.callType,
        callbackDone: updated.callbackDone,
        order: updated.order ? {
          id: updated.order.id,
          trackingNumber: updated.order.trackingNumber,
          status: updated.order.status
        } : null
      }
    })
  } catch (error) {
    console.error('Complete callback error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
