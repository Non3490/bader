import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * GET /api/orders/[id]/recordings
 * Fetch all call recordings for an order
 * ADMIN only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params

  try {
    const recordings = await db.callRecording.findMany({
      where: { orderId: id },
      include: {
        agent: { select: { name: true, phone: true } },
        order: { select: { recipientName: true, phone: string, trackingNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ data: recordings })
  } catch (error) {
    console.error('Error fetching recordings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
