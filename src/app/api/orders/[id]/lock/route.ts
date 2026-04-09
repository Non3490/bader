import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { softLockOrder, releaseLock } from '@/lib/agent-assign'
import { broadcastOrderUpdate, QUEUE_EVENTS } from '@/lib/pusher'
import { db } from '@/lib/db'

// PATCH /api/orders/[id]/lock — acquire soft lock (agent opens order)
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { id } = await params
    const acquired = await softLockOrder(id, user.id)

    if (!acquired) {
      return NextResponse.json(
        { error: 'Order is being handled by another agent. Try again in a moment.' },
        { status: 409 }
      )
    }

    // Broadcast lock event to all agents
    const order = await db.order.findUnique({
      where: { id },
      select: { trackingNumber: true }
    })
    if (order) {
      broadcastOrderUpdate(QUEUE_EVENTS.ORDER_LOCKED, {
        orderId: id,
        trackingNumber: order.trackingNumber,
        assignedAgentId: user.id,
        timestamp: new Date().toISOString()
      }).catch(err => console.error('Failed to broadcast lock:', err))
    }

    return NextResponse.json({ locked: true, lockedBy: user.id })
  } catch (error) {
    console.error('Lock error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/orders/[id]/lock — release soft lock (agent navigates away)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { id } = await params
    await releaseLock(id)

    // Broadcast unlock event to all agents
    const order = await db.order.findUnique({
      where: { id },
      select: { trackingNumber: true }
    })
    if (order) {
      broadcastOrderUpdate(QUEUE_EVENTS.ORDER_UNLOCKED, {
        orderId: id,
        trackingNumber: order.trackingNumber,
        timestamp: new Date().toISOString()
      }).catch(err => console.error('Failed to broadcast unlock:', err))
    }

    return NextResponse.json({ released: true })
  } catch (error) {
    console.error('Unlock error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
