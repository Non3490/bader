import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/phone-calls?phone=... - Get call history by phone number
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const phone = searchParams.get('phone')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!phone) {
      // If no phone provided, return today's calls for current agent
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const calls = await db.phoneCallLog.findMany({
        where: {
          agentId: user.id,
          createdAt: { gte: today }
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
        orderBy: { createdAt: 'desc' },
        take: limit
      })

      return NextResponse.json({
        calls: calls.map(call => ({
          id: call.id,
          customerPhone: call.customerPhone,
          direction: call.direction,
          callType: call.callType,
          notes: call.notes,
          durationMinutes: call.durationMinutes,
          callbackNeeded: call.callbackNeeded,
          callbackAt: call.callbackAt?.toISOString(),
          callbackDone: call.callbackDone,
          createdAt: call.createdAt.toISOString(),
          order: call.order ? {
            id: call.order.id,
            trackingNumber: call.order.trackingNumber,
            customerName: call.order.recipientName,
            status: call.order.status
          } : null
        }))
      })
    }

    // Strip non-digit characters for matching
    const cleanPhone = phone.replace(/\D/g, '')

    // Get call history for this phone number
    const calls = await db.phoneCallLog.findMany({
      where: {
        customerPhone: { contains: cleanPhone }
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true
          }
        },
        order: {
          select: {
            id: true,
            trackingNumber: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json({
      calls: calls.map(call => ({
        id: call.id,
        customerPhone: call.customerPhone,
        direction: call.direction,
        callType: call.callType,
        notes: call.notes,
        durationMinutes: call.durationMinutes,
        callbackNeeded: call.callbackNeeded,
        callbackAt: call.callbackAt?.toISOString(),
        callbackDone: call.callbackDone,
        createdAt: call.createdAt.toISOString(),
        agent: {
          id: call.agent.id,
          name: call.agent.name
        },
        order: call.order ? {
          id: call.order.id,
          trackingNumber: call.order.trackingNumber,
          status: call.order.status
        } : null
      }))
    })
  } catch (error) {
    console.error('Get phone calls error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/phone-calls - Create a phone call log entry
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
      direction,
      callType,
      orderId,
      notes,
      durationMinutes,
      callbackNeeded,
      callbackAt
    } = body as {
      customerPhone: string
      customerId?: string
      direction: 'INCOMING' | 'OUTGOING'
      callType: 'ORDER' | 'INQUIRY' | 'COMPLAINT' | 'FOLLOWUP' | 'OTHER'
      orderId?: string
      notes?: string
      durationMinutes?: number
      callbackNeeded?: boolean
      callbackAt?: string
    }

    // Validate required fields
    if (!customerPhone || !direction || !callType) {
      return NextResponse.json(
        { error: 'Missing required fields: phone, direction, callType' },
        { status: 400 }
      )
    }

    // Validate direction
    if (!['INCOMING', 'OUTGOING'].includes(direction)) {
      return NextResponse.json(
        { error: 'Invalid direction. Must be INCOMING or OUTGOING' },
        { status: 400 }
      )
    }

    // Validate call type
    const validCallTypes = ['ORDER', 'INQUIRY', 'COMPLAINT', 'FOLLOWUP', 'OTHER']
    if (!validCallTypes.includes(callType)) {
      return NextResponse.json(
        { error: `Invalid callType. Must be one of: ${validCallTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate notes length
    if (notes && notes.length > 500) {
      return NextResponse.json(
        { error: 'Notes must be 500 characters or less' },
        { status: 400 }
      )
    }

    // If orderId provided, verify it exists
    if (orderId) {
      const order = await db.order.findUnique({
        where: { id: orderId }
      })
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
    }

    // Strip non-digit characters from phone
    const cleanPhone = customerPhone.replace(/\D/g, '')

    // Create the call log
    const callLog = await db.phoneCallLog.create({
      data: {
        customerPhone: cleanPhone,
        customerId,
        direction,
        callType,
        orderId,
        agentId: user.id,
        notes: notes || null,
        durationMinutes: durationMinutes || null,
        callbackNeeded: callbackNeeded || false,
        callbackAt: callbackAt ? new Date(callbackAt) : null
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true
          }
        },
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
        action: 'PHONE_CALL_LOGGED',
        details: JSON.stringify({
          callLogId: callLog.id,
          customerPhone: cleanPhone,
          direction,
          callType,
          callbackNeeded: callLog.callbackNeeded
        })
      }
    })

    return NextResponse.json({
      success: true,
      callLog: {
        id: callLog.id,
        customerPhone: callLog.customerPhone,
        direction: callLog.direction,
        callType: callLog.callType,
        notes: callLog.notes,
        durationMinutes: callLog.durationMinutes,
        callbackNeeded: callLog.callbackNeeded,
        callbackAt: callLog.callbackAt?.toISOString(),
        createdAt: callLog.createdAt.toISOString(),
        agent: {
          id: callLog.agent.id,
          name: callLog.agent.name
        },
        order: callLog.order ? {
          id: callLog.order.id,
          trackingNumber: callLog.order.trackingNumber,
          status: callLog.order.status
        } : null
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Create phone call log error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
