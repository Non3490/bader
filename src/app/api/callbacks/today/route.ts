import { NextResponse } from 'next/server'
import { endOfDay, startOfDay } from 'date-fns'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const dayStart = startOfDay(now)
    const dayEnd = endOfDay(now)

    const callbacks = await db.order.findMany({
      where: {
        ...(user.role === 'CALL_CENTER' ? { assignedAgentId: user.id } : {}),
        scheduledCallAt: {
          gte: dayStart,
          lte: dayEnd
        },
        status: { in: ['NEW', 'NO_ANSWER', 'BUSY', 'CALLBACK', 'POSTPONED'] }
      },
      orderBy: { scheduledCallAt: 'asc' }
    })

    return NextResponse.json(callbacks.map((callback) => ({
      id: callback.id,
      orderId: callback.id,
      customerName: callback.recipientName,
      customerPhone: callback.phone,
      scheduledCallAt: callback.scheduledCallAt?.toISOString() ?? null,
      city: callback.city
    })))
  } catch (error) {
    console.error('Callbacks today error:', error)
    return NextResponse.json({ error: 'Failed to fetch callbacks' }, { status: 500 })
  }
}
