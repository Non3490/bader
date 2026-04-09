import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { canAccessOrder } from '@/lib/auth-guard'
import { logActivity } from '@/lib/activity-logger'
import { syncOrderStatusToConnectedSheets } from '@/lib/sheets-sync-helper'
import { broadcastOrderUpdate, QUEUE_EVENTS } from '@/lib/pusher'
import { runAutoFlagCheckAfterOrderUpdate } from '@/lib/blacklist-service'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (user.role !== 'DELIVERY' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Delivery only' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, note, scheduledDate } = body as {
      status?: string
      note?: string | null
      scheduledDate?: string | null
    }

    if (!status || !['DELIVERED', 'RETURNED', 'POSTPONED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid delivery status' }, { status: 400 })
    }

    const existing = await db.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        sellerId: true,
        deliveryManId: true,
        phone: true,
        trackingNumber: true,
        codAmount: true,
        platformFee: true,
        bundleDeliveryShare: true,
      },
    })

    if (!existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (!canAccessOrder(user.id, user.role, existing, user.parentSellerId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {
      status,
      note: note ?? null,
    }
    if (status === 'DELIVERED') updateData.deliveredAt = new Date()
    if (status === 'RETURNED') updateData.returnedAt = new Date()
    if (status === 'POSTPONED' && scheduledDate) updateData.scheduledCallAt = new Date(scheduledDate)

    const order = await db.order.update({
      where: { id },
      data: {
        ...updateData,
        history: {
          create: {
            previousStatus: existing.status,
            newStatus: status,
            note: note ?? null,
            changedById: user.id,
          },
        },
      },
      include: {
        seller: { select: { id: true, name: true } },
        items: { select: { productId: true, quantity: true } },
      },
    })

    if (status === 'RETURNED' || status === 'RETURN_TO_STOCK') {
      for (const item of order.items) {
        const stock = await db.stock.findFirst({ where: { productId: item.productId } })
        if (!stock) continue
        await db.stock.update({
          where: { id: stock.id },
          data: { quantity: { increment: item.quantity } },
        })
        await db.stockMovement.create({
          data: {
            stockId: stock.id,
            type: 'IN',
            quantity: item.quantity,
            reason: `Order returned: ${existing.trackingNumber}`,
          },
        })
      }
    }

    if (status === 'DELIVERED') {
      const netAmount = existing.codAmount - existing.platformFee - (existing.bundleDeliveryShare ?? 0)
      const { creditWallet } = await import('@/lib/wallet-service')
      creditWallet(
        order.sellerId,
        netAmount,
        `COD collected - order ${existing.trackingNumber}`,
        id
      ).catch(() => {})
    }

    logActivity(user.id, user.role, 'DELIVERY_STATUS_UPDATE', `Order ${id}: ${existing.status} -> ${status}`).catch(() => {})
    if (status === 'DELIVERED' || status === 'RETURNED') {
      const { flagged, metrics } = await runAutoFlagCheckAfterOrderUpdate(existing.phone)
      if (flagged && metrics) {
        // Log for admin visibility
        await db.activityLog.create({
          data: {
            userId: user.id,
            role: user.role,
            action: 'BLACKLIST_AUTO_FLAGGED',
            details: `🚫 Auto-flagged ${existing.phone}: ${metrics.totalOrders} orders, ${metrics.confirmationRate}% confirm rate, ${metrics.deliveryRate}% delivery rate. Last order: ${existing.trackingNumber} → ${status}`
          }
        }).catch(err => console.error('Failed to log auto-flag:', err))
      }
    }

    syncOrderStatusToConnectedSheets(order.sellerId, existing.trackingNumber, status).catch(() => {})
    broadcastOrderUpdate(QUEUE_EVENTS.ORDER_UPDATED, {
      orderId: id,
      trackingNumber: existing.trackingNumber,
      status,
      sellerId: order.sellerId,
      timestamp: new Date().toISOString(),
    }).catch(() => {})

    return NextResponse.json({ success: true, order })
  } catch (error) {
    console.error('Delivery status PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
