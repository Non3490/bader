import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/call-center/assign - Reassign phone order to agent
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, agentId } = body as {
      orderId: string
      agentId: string
    }

    if (!orderId || !agentId) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, agentId' },
        { status: 400 }
      )
    }

    // Verify the order exists and is a phone order
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        source: true,
        assignedAgentId: true
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.source !== 'PHONE') {
      return NextResponse.json(
        { error: 'Only phone orders can be reassigned' },
        { status: 400 }
      )
    }

    // Verify the target agent exists and is a call center agent
    const targetAgent = await db.user.findFirst({
      where: {
        id: agentId,
        role: 'CALL_CENTER',
        isActive: true
      }
    })

    if (!targetAgent) {
      return NextResponse.json(
        { error: 'Target agent not found or not a call center agent' },
        { status: 404 }
      )
    }

    // Update order assignment
    const updated = await db.order.update({
      where: { id: orderId },
      data: {
        assignedAgentId: agentId
      },
      select: {
        id: true,
        trackingNumber: true,
        assignedAgentId: true
      }
    })

    // Log the reassignment
    await db.activityLog.create({
      data: {
        userId: user.id,
        role: user.role,
        action: 'ORDER_REASSIGNED',
        details: JSON.stringify({
          orderId,
          fromAgentId: order.assignedAgentId,
          toAgentId: agentId
        })
      }
    })

    return NextResponse.json({
      success: true,
      order: {
        id: updated.id,
        trackingNumber: updated.trackingNumber,
        assignedAgentId: updated.assignedAgentId
      }
    })
  } catch (error) {
    console.error('Assign order error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
