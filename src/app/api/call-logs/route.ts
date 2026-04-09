import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getNextPeakHour } from '@/lib/agent-assign'
import { getAgentStats } from '@/lib/agent-stats'
import { updateCustomerDeliveryRate } from '@/lib/customer-stats'

// GET /api/call-logs - Today's call logs for the current agent
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const logs = await db.callLog.findMany({
      where: {
        agentId: user.id,
        createdAt: { gte: today }
      },
      include: {
        order: {
          select: { trackingNumber: true, recipientName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    const noAnswerCount = logs.filter(l => l.attempt === 'NO_ANSWER').length
    const stats = await getAgentStats(user.id, today, new Date())

    return NextResponse.json({
      logs: logs.map(log => ({
        id: log.id,
        orderId: log.orderId,
        orderTracking: log.order.trackingNumber,
        customerName: log.order.recipientName,
        attempt: log.attempt,
        comment: log.comment,
        createdAt: log.createdAt.toISOString()
      })),
      stats: {
        totalCalls: stats.totalCalls,
        confirmed: stats.confirmed,
        cancelled: stats.cancelled,
        noAnswer: noAnswerCount
      }
    })
  } catch (error) {
    console.error('Call logs GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/call-logs - Create a call log with smart recall
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json()
    const { orderId, attempt, comment } = body

    if (!orderId || !attempt) {
      return NextResponse.json({ error: 'Missing required fields: orderId, attempt' }, { status: 400 })
    }

    // Fetch order details for smart recall
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { id: true, phone: true, status: true }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Create call log
    const callLog = await db.callLog.create({
      data: { orderId, agentId: user.id, attempt, comment },
      select: {
        id: true,
        orderId: true,
        agentId: true,
        attempt: true,
        comment: true,
        createdAt: true
      }
    })

    // Smart Recall: Auto-schedule callback at peak hours for NO_ANSWER
    if (attempt === 'NO_ANSWER') {
      const scheduledCallAt = getNextPeakHour()
      await db.order.update({
        where: { id: orderId },
        data: { scheduledCallAt }
      })
    } else {
      // Clear scheduled callback for successful attempts
      await db.order.update({
        where: { id: orderId },
        data: { scheduledCallAt: null }
      })
    }

    // Update customer delivery rate when order is DELIVERED or RETURNED
    if (order.status === 'DELIVERED' || order.status === 'RETURNED') {
      updateCustomerDeliveryRate(order.phone).catch(err => {
        console.error('Failed to update customer delivery rate:', err)
      })
    }

    return NextResponse.json({
      callLog: {
        ...callLog,
        createdAt: new Date(callLog.createdAt).toISOString()
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Call logs POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
