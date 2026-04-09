import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

interface ScheduleBody {
  scheduledCallAt: string // ISO date string
}

/**
 * POST /api/orders/[id]/schedule - Schedule a callback for an order
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const orderId = params.id
    const body: ScheduleBody = await request.json()
    const { scheduledCallAt } = body

    if (!scheduledCallAt) {
      return NextResponse.json({ error: 'Missing scheduledCallAt field' }, { status: 400 })
    }

    const scheduledDate = new Date(scheduledCallAt)

    // Validate that scheduled time is in the future
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    if (scheduledDate <= new Date()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 })
    }

    // Update order with scheduled callback time
    const order = await db.order.update({
      where: { id: orderId },
      data: { scheduledCallAt: scheduledDate },
      include: {
        seller: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({
      success: true,
      order,
      scheduledCallAt: scheduledDate.toISOString()
    })
  } catch (error) {
    console.error('Schedule POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/orders/[id]/schedule - Clear scheduled callback for an order
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const orderId = params.id

    // Clear scheduled callback time
    const order = await db.order.update({
      where: { id: orderId },
      data: { scheduledCallAt: null },
      include: {
        seller: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({
      success: true,
      order,
      scheduledCallAt: null
    })
  } catch (error) {
    console.error('Schedule DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
