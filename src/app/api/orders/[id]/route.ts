import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canAccessOrder } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { creditWallet } from '@/lib/wallet-service'
import { logActivity } from '@/lib/activity-logger'
import { syncOrderStatusToConnectedSheets } from '@/lib/sheets-sync-helper'
import { broadcastOrderUpdate, QUEUE_EVENTS } from '@/lib/pusher'
import { runAutoFlagCheckAfterOrderUpdate } from '@/lib/blacklist-service'
import { detectAndAssignBundle } from '@/lib/bundle-detection'
import { deductStockForOrder, restoreStockForOrder, validateStockAvailability } from '@/lib/stock-service'
import { assignOrderToDeliveryZone } from '@/lib/zone-assigner'
import { autoAssignOrder } from '@/lib/driver-auto-assign'
import { sendNotification } from '@/lib/notifications'

// GET /api/orders/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { id } = await params

    const order = await db.order.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true, email: true, role: true, phone: true } },
        deliveryMan: { select: { id: true, name: true, phone: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, costPrice: true, sellPrice: true } } } },
        history: { orderBy: { createdAt: 'desc' } },
        callLogs: {
          include: { agent: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    if (!canAccessOrder(user.id, user.role, order, user.parentSellerId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Backward-compat aliases for existing UI pages
    // Strip cost/margin fields for CALL_CENTER role
    const responseOrder: Record<string, unknown> = {
      ...order,
      customerName: order.recipientName,
      customerPhone: order.phone,
      customerAddress: order.address,
      notes: order.note,
      callLogs: order.callLogs.map(log => ({ ...log, status: log.attempt, notes: log.comment })),
      history: order.history.map(h => ({ ...h, oldStatus: h.previousStatus, notes: h.note }))
    }

    if (user.role === 'CALL_CENTER') {
      // Remove sensitive financial fields
      delete responseOrder.productCost
      delete responseOrder.shippingCost
      delete responseOrder.callCenterFee
      delete responseOrder.adSpend
      // Also strip from items if they exist
      if (responseOrder.items && Array.isArray(responseOrder.items)) {
        responseOrder.items = (responseOrder.items as any[]).map((item: any) => {
          const { costPrice, ...safeItem } = item
          return safeItem
        })
      }
    }

    return NextResponse.json({ order: responseOrder })
  } catch (error) {
    console.error('Get order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/orders/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { status, note, deliveryManId, scheduledCallAt } = body

    const existing = await db.order.findUnique({
      where: { id },
      select: {
        status: true,
        sellerId: true,
        deliveryManId: true,
        callAttempts: true,
        assignedAgentId: true,
        trackingNumber: true,
        phone: true
      }
    })

    if (!existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    if (!canAccessOrder(user.id, user.role, { sellerId: existing.sellerId, deliveryManId: existing.deliveryManId }, user.parentSellerId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}

    if (status && status !== existing.status) {
      updateData.status = status
      if (status === 'CONFIRMED') {
        updateData.confirmedAt = new Date()
        // Assign the order to the current agent when confirmed
        if (user.role === 'CALL_CENTER' && !existing.assignedAgentId) {
          updateData.assignedAgentId = user.id
        }
        // CORE-04: Auto-deduct stock on confirmation using atomic operations
        const stockResult = await deductStockForOrder(id, { performedBy: user.id })
        if (!stockResult.success) {
          return NextResponse.json({
            error: stockResult.error || 'Stock deduction failed'
          }, { status: 400 })
        }
      }
      if (status === 'SHIPPED') {
        updateData.shippedAt = new Date()
        // Auto-assign to delivery zone if not already assigned
        if (!existing.deliveryManId) {
          const order = await db.order.findUnique({
            where: { id },
            select: { address: true, city: true }
          })
          if (order) {
            assignOrderToDeliveryZone(id, order.address, order.city).catch(err => {
              console.error('Failed to auto-assign order to delivery zone:', err)
            })
          }
        }
        // CORE-03: Auto-assign to available driver (fewest active deliveries)
        autoAssignOrder(id).catch(err => {
          console.error('Failed to auto-assign order to driver:', err)
        })
      }
      if (status === 'DELIVERED') updateData.deliveredAt = new Date()
      if (status === 'RETURNED') {
        updateData.returnedAt = new Date()
        // CORE-04: Auto-return stock when order is returned
        const restoreResult = await restoreStockForOrder(id, { performedBy: user.id })
        if (!restoreResult.success) {
          console.error('Stock restoration failed:', restoreResult.error)
        }
      }
      if (status === 'RETURN_TO_STOCK') {
        updateData.returnedAt = new Date()
        // CORE-04: Auto-return stock when order is returned to stock
        const restoreResult = await restoreStockForOrder(id, { performedBy: 'SYSTEM' })
        if (!restoreResult.success) {
          console.error('Stock restoration failed:', restoreResult.error)
        }
      }
      if (status === 'CANCELLED') {
        updateData.cancelledAt = new Date()
        // CORE-04: Also restore stock when order is cancelled (if already confirmed)
        if (existing.status === 'CONFIRMED' || existing.status === 'SHIPPED') {
          const restoreResult = await restoreStockForOrder(id, { performedBy: 'SYSTEM' })
          if (!restoreResult.success) {
            console.error('Stock restoration failed:', restoreResult.error)
          }
        }
      }

      // Smart Recall - Auto-reschedule
      if (['NO_ANSWER', 'BUSY', 'CALLBACK'].includes(status)) {
        const attempts = (existing.callAttempts || 0) + 1
        updateData.callAttempts = attempts

        if (attempts >= 5) {
          updateData.status = 'UNREACHED'
          updateData.scheduledCallAt = null
        } else {
          if (status === 'CALLBACK' && scheduledCallAt) {
            updateData.scheduledCallAt = new Date(scheduledCallAt)
          } else if (status === 'NO_ANSWER' || status === 'BUSY' || (status === 'CALLBACK' && !scheduledCallAt)) {
            const now = new Date()
            let scheduledTime = new Date(now)
            
            if (attempts === 1) {
              scheduledTime.setMinutes(scheduledTime.getMinutes() + 15)
            } else if (attempts === 2) {
              scheduledTime.setHours(scheduledTime.getHours() + 1)
            } else if (attempts === 3) {
              scheduledTime.setHours(scheduledTime.getHours() + 3)
            } else if (attempts === 4) {
              scheduledTime.setDate(scheduledTime.getDate() + 1)
              scheduledTime.setUTCHours(8, 0, 0, 0)
            }
            updateData.scheduledCallAt = scheduledTime
          }
        }
      } else if (scheduledCallAt) {
        updateData.scheduledCallAt = new Date(scheduledCallAt)
      }
    } else if (scheduledCallAt) {
       // if only updating scheduledCallAt
       updateData.scheduledCallAt = new Date(scheduledCallAt)
    }

    if (note !== undefined) updateData.note = note
    if (deliveryManId !== undefined && user.role === 'ADMIN') updateData.deliveryManId = deliveryManId

    const order = await db.order.update({
      where: { id },
      data: {
        ...updateData,
        history: status && status !== existing.status ? {
          create: {
            previousStatus: existing.status,
            newStatus: status,
            note: note,
            changedById: user.id
          }
        } : undefined
      },
      select: {
        id: true,
        trackingNumber: true,
        sellerId: true,
        recipientName: true,
        phone: true,
        address: true,
        city: true,
        note: true,
        codAmount: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // CORE-04: Auto stock deduction and return handled via atomic stock-service when status changes to CONFIRMED, RETURNED, CANCELLED, or RETURN_TO_STOCK (see above)


    // Credit seller wallet when order is delivered (minus platform fee and bundle delivery share)
    if (status === 'DELIVERED' && status !== existing.status) {
        const fullOrder = await db.order.findUnique({ where: { id }, select: { codAmount: true, platformFee: true, sellerId: true, deliveryManId: true, bundleDeliveryShare: true } })
      if (fullOrder) {
        const deliveryFee = fullOrder.bundleDeliveryShare ?? 0
        const netAmount = fullOrder.codAmount - fullOrder.platformFee - deliveryFee
        const feeDescription = `COD collected — order ${id} (platform fee -${fullOrder.platformFee}, delivery fee -${deliveryFee.toFixed(0)})`
        creditWallet(fullOrder.sellerId, netAmount, feeDescription, id).catch(() => {})

        // Create delivery fee expense for delivery man
        if (fullOrder.deliveryManId) {
          let feeAmount = deliveryFee
          // If not part of a bundle, use delivery fee config
          if (!fullOrder.bundleDeliveryShare) {
            const deliveryFeeConfig = await db.deliveryFeeConfig.findUnique({
              where: { deliveryManId: fullOrder.deliveryManId }
            })
            feeAmount = deliveryFeeConfig?.costPerDelivery ?? 0
          }

          if (feeAmount > 0) {
            await db.expense.create({
              data: {
                category: 'DELIVERY_FEE',
                amount: feeAmount,
                description: `Delivery fee for order ${existing.trackingNumber}${fullOrder.bundleDeliveryShare ? ' (bundle share)' : ''}`,
                agentId: fullOrder.deliveryManId,
                orderId: id
              }
            })
          }
        }
      }
    }

    logActivity(user.id, user.role, 'ORDER_STATUS_UPDATE', `Order ${id}: ${existing.status} → ${status ?? existing.status}`).catch(() => {})

    // Auto-flag customer if they meet blacklist criteria
    if (status && status !== existing.status && (status === 'CONFIRMED' || status === 'DELIVERED' || status === 'RETURNED')) {
      const { flagged, metrics } = await runAutoFlagCheckAfterOrderUpdate(order.phone)
      if (flagged && metrics) {
        // Log for admin visibility
        await db.activityLog.create({
          data: {
            userId: user.id,
            role: user.role,
            action: 'BLACKLIST_AUTO_FLAGGED',
            details: `🚫 Auto-flagged ${order.phone}: ${metrics.totalOrders} orders, ${metrics.confirmationRate}% confirm rate, ${metrics.deliveryRate}% delivery rate. Last order: ${order.trackingNumber} → ${status}`
          }
        }).catch(err => console.error('Failed to log auto-flag:', err))
      }
    }

    // Check for bundle detection when order is confirmed
    if (status && status === 'CONFIRMED' && status !== existing.status) {
      detectAndAssignBundle(id).catch(err => {
        console.error('Failed to run bundle detection:', err)
      })
    }

    // Auto-sync order status to Google Sheets (write-back)
    if (status && status !== existing.status) {
      syncOrderStatusToConnectedSheets(existing.sellerId, order.trackingNumber, status).catch(err => {
        console.error('Failed to sync to Google Sheets:', err)
      })

      // Broadcast real-time queue update via Pusher
      broadcastOrderUpdate(QUEUE_EVENTS.ORDER_UPDATED, {
        orderId: order.id,
        trackingNumber: order.trackingNumber,
        status: order.status,
        sellerId: order.sellerId,
        timestamp: new Date().toISOString()
      }).catch(err => {
        console.error('Failed to broadcast order update:', err)
      })
    }

    // Broadcast delivery man assignment change
    if (deliveryManId !== undefined && user.role === 'ADMIN') {
      broadcastOrderUpdate(QUEUE_EVENTS.ORDER_ASSIGNED, {
        orderId: order.id,
        trackingNumber: order.trackingNumber,
        timestamp: new Date().toISOString()
      }).catch(err => {
        console.error('Failed to broadcast assignment:', err)
      })
    }

    // Send notification for applicable status changes (fire and forget)
    if (status && status !== existing.status) {
      const notifyOnStatuses: Record<string, string> = {
        'CONFIRMED': 'ORDER_CONFIRMED',
        'SHIPPED': 'ORDER_SHIPPED',
        'DELIVERED': 'ORDER_DELIVERED',
        'RETURNED': 'ORDER_RETURNED',
        'RETURN_TO_STOCK': 'ORDER_RETURNED',
      }

      const notifType = notifyOnStatuses[status]
      if (notifType) {
        // Fire and forget — don't await to avoid slowing down the response
        sendNotification(order, notifType, 'SMS').catch(err =>
          console.error(`Notification send failed for order ${order.id}:`, err)
        )
      }
    }

    // Strip cost-related fields for CALL_CENTER role
    const responseOrder: Record<string, unknown> = {
      ...order,
      customerName: order.recipientName,
      customerPhone: order.phone,
      customerAddress: order.address,
      notes: order.note
    }

    return NextResponse.json({ order: responseOrder })
  } catch (error) {
    console.error('Update order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/orders/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { id } = await params

    // onDelete: Cascade handles history and callLogs — but expenses need manual check
    await db.order.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
