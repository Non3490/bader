import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/agents/heartbeat
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Only call center agents use heartbeat
    if (user.role !== 'CALL_CENTER') {
      return NextResponse.json({ error: 'Call center only' }, { status: 403 })
    }

    const now = new Date()

    // Upsert agent session
    const session = await db.agentSession.upsert({
      where: { userId: user.id },
      update: {
        lastSeen: now,
        isOnline: true
      },
      create: {
        userId: user.id,
        lastSeen: now,
        isOnline: true
      }
    })

    // Agent is online if lastSeen within 5 minutes
    const isOnline = session ? (now.getTime() - session.lastSeen.getTime()) < 300000 : false

    return NextResponse.json({
      success: true,
      isOnline,
      lastSeen: session?.lastSeen
    })
  } catch (error) {
    console.error('Heartbeat error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/agents/heartbeat - Get list of online agents (admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Admin route: only admins and super admins can view online agents
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Mark agents as offline if not seen in last 90 seconds
    const cutoff = new Date(Date.now() - 90 * 1000)
    await db.agentSession.updateMany({
      where: { lastSeen: { lt: cutoff }, isOnline: true },
      data: { isOnline: false }
    })

    const onlineAgents = await db.agentSession.findMany({
      where: { isOnline: true },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    })

    return NextResponse.json({ onlineAgents, count: onlineAgents.length })
  } catch (error) {
    console.error('Heartbeat GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
