import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'
import { broadcastBundleDetection, broadcastOrderUpdate, QUEUE_EVENTS } from '@/lib/pusher'
import { sendBundleAlert } from '@/lib/notifications'

// GET /api/orders/bundle - Get bundle delivery fee split info
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const searchParams = request.nextUrl.searchParams
    const bundleId = searchParams.get('bundleId')

    if (!bundleId) {
      return NextResponse.json({ error: 'bundleId is required' }, { status: 400 })
    }

    const bundleOrders = await db.order.findMany({
      where: {
        bundleGroupId: bundleId,
        status: { notIn: ['CANCELLED', 'RETURN_TO_STOCK', 'DELIVERED', 'RETURNED'] }
      },
      include: {
        seller: {
          select: { id: true, name: true }
        },
        items: {
          include: {
            product: true
          }
        }
      }
    })

    return NextResponse.json({ bundleId, orders: bundleOrders })
  } catch (error) {
    console.error('Bundle GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch bundle' }, { status: 500 })
  }
}

// POST /api/orders/bundle - Confirm all orders in a bundle with delivery fee splitting
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'CALL_CENTER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { bundleId, deliveryFee } = body

    if (!bundleId) {
      return NextResponse.json({ error: 'bundleId is required' }, { status: 400 })
    }

    // Find all orders with same bundleGroupId
    const bundleOrders = await db.order.findMany({
      where: {
        bundleGroupId: bundleId,
        status: { notIn: ['CANCELLED', 'RETURN_TO_STOCK', 'DELIVERED', 'RETURNED'] }
      },
      include: {
        seller: {
          select: { id: true, name: true }
        },
        items: {
          include: {
            product: true
          }
        }
      }
    })

    if (bundleOrders.length === 0) {
      return NextResponse.json({ error: 'No pending orders found for this bundle' }, { status: 404 })
    }

    // Calculate delivery fee split proportionally by COD amount
    const totalCod = bundleOrders.reduce((sum, o) => sum + o.codAmount, 0)
    const feeToSplit = deliveryFee ?? 3000 // Default 3000 XAF if not provided

    const now = new Date()
    const updatedOrders = await db.$transaction(async (tx) => {
      const orders = await Promise.all(
        bundleOrders.map((order) => {
          // Calculate proportional share of delivery fee
          const feeShare = (order.codAmount / totalCod) * feeToSplit

          return tx.order.update({
            where: { id: order.id },
            data: {
              status: 'CONFIRMED',
              confirmedAt: now,
              bundleDeliveryShare: feeShare,
              shippingCost: feeShare, // Update shippingCost to reflect share
              history: {
                create: {
                  newStatus: 'CONFIRMED',
                  changedById: user.id,
                  note: `Bundle confirmed - delivery fee share: ${feeShare.toFixed(0)} XAF`
                }
              }
            },
            include: {
              seller: {
                select: { id: true, name: true }
              }
            }
          })
        })
      )
      return orders
    })

    // Get customer info from first order
    const firstOrder = updatedOrders[0]
    const customerName = firstOrder.recipientName
    const customerPhone = firstOrder.phone
    const sellerCount = new Set(updatedOrders.map(o => o.sellerId)).size
    const totalItems = updatedOrders.reduce((sum, o) => sum + o.items.reduce((is, i) => is + i.quantity, 0), 0)

    // Create warehouse alert notification
    await logActivity(
      user.id,
      user.role,
      'BUNDLE_CONFIRMED',
      `Bundle confirmed - ${customerName} - ${sellerCount} sellers - ${totalItems} items - Pack in one package`,
      {
        bundleId,
        customerName,
        customerPhone,
        sellerCount,
        totalItems,
        orderCount: updatedOrders.length,
        orderIds: updatedOrders.map(o => o.id)
      }
    )

    // Create individual activity logs for each seller
    for (const order of updatedOrders) {
      await logActivity(
        user.id,
        user.role,
        'ORDER_CONFIRMED',
        `Order ${order.trackingNumber} confirmed (bundle)`,
        { orderId: order.id, trackingNumber: order.trackingNumber, sellerId: order.sellerId }
      )

      // Broadcast order update for each order in bundle
      broadcastOrderUpdate(QUEUE_EVENTS.ORDER_UPDATED, {
        orderId: order.id,
        trackingNumber: order.trackingNumber,
        status: 'CONFIRMED',
        bundleGroupId: bundleId,
        timestamp: new Date().toISOString()
      }).catch(err => console.error('Failed to broadcast bundle order update:', err))
    }

    // Broadcast bundle detection event
    broadcastBundleDetection({
      bundleGroupId: bundleId,
      orderCount: updatedOrders.length,
      customerPhone: customerPhone,
      customerName: customerName,
      totalCodAmount: totalCod,
      timestamp: new Date().toISOString()
    }).catch(err => console.error('Failed to broadcast bundle detection:', err))

    // Send bundle alert to admin/warehouse
    sendBundleAlert(bundleId, updatedOrders).catch(err => {
      console.error('Failed to send bundle alert:', err)
    })

    return NextResponse.json({
      success: true,
      confirmedCount: updatedOrders.length,
      customerName,
      sellerCount,
      totalItems,
      message: `Confirmed ${updatedOrders.length} orders from ${sellerCount} sellers for ${customerName}`
    })
  } catch (error) {
    console.error('Bundle confirm error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to confirm bundle' },
      { status: 500 }
    )
  }
}
