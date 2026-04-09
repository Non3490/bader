import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getAgentStats } from '@/lib/agent-assign'
import { broadcastAgentNotification } from '@/lib/pusher'

// GET /api/admin/call-center — live agent stats + queue overview
export async function GET(_req: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const [agentStats, queueSummary] = await Promise.all([
      getAgentStats(),
      db.order.groupBy({
        by: ['assignedAgentId'],
        where: { status: 'NEW' },
        _count: { _all: true }
      })
    ])

    const unassigned = await db.order.count({
      where: { status: 'NEW', assignedAgentId: null }
    })

    const totalNew = await db.order.count({ where: { status: 'NEW' } })

    return NextResponse.json({
      agents: agentStats,
      queue: {
        totalNew,
        unassigned,
        byAgent: queueSummary.map(g => ({
          agentId: g.assignedAgentId,
          count: g._count._all
        }))
      }
    })
  } catch (error) {
    console.error('Admin call center GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/call-center — reassign leads from one agent to another
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { fromAgentId, toAgentId, orderIds } = body

    // Validate target agent
    const targetAgent = await db.user.findUnique({
      where: { id: toAgentId },
      select: { id: true, name: true, role: true, isActive: true }
    })

    if (!targetAgent || targetAgent.role !== 'CALL_CENTER' || !targetAgent.isActive) {
      return NextResponse.json({ error: 'Invalid target agent' }, { status: 400 })
    }

    let where: Record<string, unknown>

    if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
      // Reassign specific orders
      where = { id: { in: orderIds }, status: 'NEW' }
    } else if (fromAgentId) {
      // Reassign all pending leads from a specific agent
      where = { assignedAgentId: fromAgentId, status: 'NEW' }
    } else {
      return NextResponse.json({ error: 'Provide fromAgentId or orderIds' }, { status: 400 })
    }

    const result = await db.order.updateMany({
      where,
      data: {
        assignedAgentId: toAgentId,
        lockedByAgentId: null,
        lockedAt: null
      }
    })

    if (result.count > 0) {
      const notification = await db.notification.create({
        data: {
          userId: toAgentId,
          title: 'Orders Assigned',
          message: `Admin assigned ${result.count} new order${result.count > 1 ? 's' : ''} to your queue`,
          type: 'ASSIGNMENT',
          link: '/call-center'
        }
      })

      await broadcastAgentNotification(toAgentId, {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        link: notification.link,
        isRead: notification.isRead,
        createdAt: notification.createdAt.toISOString()
      })
    }

    return NextResponse.json({
      success: true,
      reassigned: result.count,
      toAgent: targetAgent.name
    })
  } catch (error) {
    console.error('Reassign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
