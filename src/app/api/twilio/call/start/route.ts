import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * POST /api/twilio/call/start
 * Create PENDING recording entry when call starts
 */
export async function POST(request: NextRequest) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { orderId, phoneNumber } = body

    if (!orderId || !phoneNumber) {
      return NextResponse.json({ error: 'orderId and phoneNumber are required' }, { status: 400 })
    }

    // Verify order exists
    const order = await db.order.findUnique({
      where: { id: orderId }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check permissions - CALL_CENTER can call any order
    if (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Create PENDING recording entry
    const recording = await db.callRecording.create({
      data: {
        orderId,
        agentId: user.id,
        status: 'PENDING'
      }
    })

    return NextResponse.json({
      success: true,
      recordingId: recording.id
    })
  } catch (error) {
    console.error('Failed to create recording entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
