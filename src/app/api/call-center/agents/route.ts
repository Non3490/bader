import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/call-center/agents - Get list of agents for reassignment
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all active call center agents
    const agents = await db.user.findMany({
      where: {
        role: 'CALL_CENTER',
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true
      },
      orderBy: { name: 'asc' }
    })

    // Get current workload for each agent (pending orders)
    const agentsWithWorkload = await Promise.all(
      agents.map(async (agent) => {
        const twoHoursAgo = new Date()
        twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)

        const pendingOrders = await db.order.count({
          where: {
            assignedAgentId: agent.id,
            source: 'PHONE',
            status: { in: ['NEW', 'CONFIRMED'] },
            createdAt: { gte: twoHoursAgo }
          }
        })

        // Get agent session if available
        const session = await db.agentSession.findUnique({
          where: { userId: agent.id }
        })

        return {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          phone: agent.phone,
          pendingOrders,
          isOnline: session?.isOnline || false,
          currentWorkload: session?.currentWorkload || 0
        }
      })
    )

    return NextResponse.json({ agents: agentsWithWorkload })
  } catch (error) {
    console.error('Get agents error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
