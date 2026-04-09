import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/phone-calls/callbacks - Get pending/overdue callbacks for current agent
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Get overdue callbacks (callbackAt has passed, not done)
    const overdueCallbacks = await db.phoneCallLog.findMany({
      where: {
        agentId: user.id,
        callbackNeeded: true,
        callbackDone: false,
        callbackAt: { lte: now }
      },
      include: {
        order: {
          select: {
            id: true,
            trackingNumber: true,
            recipientName: true,
            status: true
          }
        }
      },
      orderBy: { callbackAt: 'asc' }
    })

    // Get upcoming callbacks (callbackAt in future, not done)
    const upcomingCallbacks = await db.phoneCallLog.findMany({
      where: {
        agentId: user.id,
        callbackNeeded: true,
        callbackDone: false,
        callbackAt: { gt: now }
      },
      include: {
        order: {
          select: {
            id: true,
            trackingNumber: true,
            recipientName: true,
            status: true
          }
        }
      },
      orderBy: { callbackAt: 'asc' }
    })

    return NextResponse.json({
      overdue: overdueCallbacks.map(cb => ({
        id: cb.id,
        customerPhone: cb.customerPhone,
        callType: cb.callType,
        notes: cb.notes,
        callbackAt: cb.callbackAt?.toISOString(),
        order: cb.order ? {
          id: cb.order.id,
          trackingNumber: cb.order.trackingNumber,
          customerName: cb.order.recipientName,
          status: cb.order.status
        } : null
      })),
      upcoming: upcomingCallbacks.map(cb => ({
        id: cb.id,
        customerPhone: cb.customerPhone,
        callType: cb.callType,
        notes: cb.notes,
        callbackAt: cb.callbackAt?.toISOString(),
        order: cb.order ? {
          id: cb.order.id,
          trackingNumber: cb.order.trackingNumber,
          customerName: cb.order.recipientName,
          status: cb.order.status
        } : null
      }))
    })
  } catch (error) {
    console.error('Get callbacks error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/phone-calls/callbacks - Schedule a new callback
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      customerPhone,
      customerId,
      callType,
      orderId,
      notes,
      callbackAt
    } = body as {
      customerPhone: string
      customerId?: string
      callType?: string
      orderId?: string
      notes?: string
      callbackAt: string
    }

    if (!customerPhone || !callbackAt) {
      return NextResponse.json(
        { error: 'Missing required fields: customerPhone, callbackAt' },
        { status: 400 }
      )
    }

    // Validate callbackAt is in the future
    const callbackDate = new Date(callbackAt)
    if (callbackDate <= new Date()) {
      return NextResponse.json(
        { error: 'Callback time must be in the future' },
        { status: 400 }
      )
    }

    // Strip non-digit characters from phone
    const cleanPhone = customerPhone.replace(/\D/g, '')

    // Create callback entry as a phone call log
    const callback = await db.phoneCallLog.create({
      data: {
        customerPhone: cleanPhone,
        customerId,
        direction: 'OUTGOING',
        callType: callType || 'FOLLOWUP',
        orderId,
        agentId: user.id,
        notes,
        callbackNeeded: true,
        callbackAt: callbackDate
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

    return NextResponse.json({
      success: true,
      callback: {
        id: callback.id,
        customerPhone: callback.customerPhone,
        callType: callback.callType,
        notes: callback.notes,
        callbackAt: callback.callbackAt?.toISOString(),
        order: callback.order ? {
          id: callback.order.id,
          trackingNumber: callback.order.trackingNumber,
          status: callback.order.status
        } : null
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Create callback error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
