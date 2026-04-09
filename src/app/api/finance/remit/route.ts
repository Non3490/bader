import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/finance/remit - Admin collects cash from delivery agent
export async function POST(request: Request) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { deliveryAgentId } = await request.json()
    if (!deliveryAgentId) return NextResponse.json({ error: 'Missing deliveryAgentId' }, { status: 400 })

    // Get DELIVERED orders assigned to this agent with note not containing [REMITTED]
    const deliveredOrders = await db.order.findMany({
      where: {
        deliveryManId: deliveryAgentId,
        status: 'DELIVERED',
        NOT: { note: { contains: '[REMITTED]' } }
      },
      select: { id: true, codAmount: true, note: true }
    })

    if (deliveredOrders.length === 0) {
      return NextResponse.json({ message: 'No pending cash to collect', remittedAmount: 0, ordersProcessed: 0 })
    }

    let collectedAmount = 0
    const now = new Date()
    for (const order of deliveredOrders) {
      collectedAmount += order.codAmount
      await db.order.update({
        where: { id: order.id },
        data: { note: order.note ? `${order.note} [REMITTED]` : '[REMITTED]' }
      })
    }

    // Find the delivery agent to get their sellerId
    const agent = await db.user.findUnique({
      where: { id: deliveryAgentId },
      select: { id: true, name: true }
    })

    // Create an Invoice record for this remittance
    const refNum = `REM-${Date.now().toString(36).toUpperCase()}`
    const invoice = await db.invoice.create({
      data: {
        ref: refNum,
        sellerId: user.id,
        dateFrom: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        dateTo: now,
        cashCollected: collectedAmount,
        subtotal: collectedAmount,
        totalNet: collectedAmount,
        status: 'UNPAID',
        isLocked: true
      }
    })

    return NextResponse.json({
      success: true,
      remittedAmount: collectedAmount,
      ordersProcessed: deliveredOrders.length,
      invoiceId: invoice.id,
      invoiceRef: invoice.ref
    })
  } catch (error: unknown) {
    console.error('Remit error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process remittance' },
      { status: 500 }
    )
  }
}

// GET /api/finance/remit - Get pending cash per delivery agent
export async function GET() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const pendingOrders = await db.order.findMany({
      where: {
        status: 'DELIVERED',
        deliveryManId: { not: null },
        NOT: { note: { contains: '[REMITTED]' } }
      },
      select: {
        deliveryManId: true,
        codAmount: true,
        deliveryMan: { select: { id: true, name: true } }
      }
    })

    // Group by delivery agent
    const agentMap: Record<string, { name: string; pendingAmount: number; ordersCount: number }> = {}
    for (const order of pendingOrders) {
      if (!order.deliveryManId) continue
      if (!agentMap[order.deliveryManId]) {
        agentMap[order.deliveryManId] = {
          name: order.deliveryMan?.name ?? 'Unknown',
          pendingAmount: 0,
          ordersCount: 0
        }
      }
      agentMap[order.deliveryManId].pendingAmount += order.codAmount
      agentMap[order.deliveryManId].ordersCount++
    }

    return NextResponse.json({
      agents: Object.entries(agentMap).map(([id, data]) => ({ id, ...data }))
    })
  } catch (error) {
    console.error('Remit GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
