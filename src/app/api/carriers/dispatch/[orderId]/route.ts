import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

/**
 * POST /api/carriers/dispatch/[orderId]
 * Dispatch order to carrier and get AWB
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { orderId } = await params

  try {
    const body = await request.json()
    const { carrierName } = body

    if (!carrierName) {
      return NextResponse.json({ error: 'carrierName is required' }, { status: 400 })
    }

    // Validate carrier name
    const validCarriers = ['shipsen', 'colisswift', 'afriquecod']
    if (!validCarriers.includes(carrierName.toLowerCase())) {
      return NextResponse.json({ error: `Invalid carrier. Must be one of: ${validCarriers.join(', ')}` }, { status: 400 })
    }

    // Get order
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { seller: { select: { name: true } } }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check permissions - ADMIN can dispatch all, SELLER can dispatch their own
    if (user.role === 'SELLER' && order.sellerId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Order must be CONFIRMED before dispatch
    if (order.status !== 'CONFIRMED') {
      return NextResponse.json({ error: 'Order must be in CONFIRMED status to dispatch' }, { status: 400 })
    }

    // Get carrier settings
    const carrier = await db.carrierSettings.findFirst({
      where: {
        name: carrierName.toLowerCase(),
        isActive: true
      }
    })

    if (!carrier) {
      return NextResponse.json({ error: `Carrier ${carrierName} not configured` }, { status: 400 })
    }

    // Dispatch to carrier (implementation depends on carrier API)
    const result = await dispatchToCarrier(carrierName, carrier, order)

    // Update order with carrier info and change status to SHIPPED
    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        carrierId: carrier.id,
        carrierName: carrierName.toUpperCase(),
        awbTrackingCode: result.trackingNumber,
        awbLabelUrl: result.labelUrl,
        dispatchedAt: new Date(),
        status: 'SHIPPED',
        shippedAt: new Date()
      }
    })

    // Create order history entry
    await db.orderHistory.create({
      data: {
        orderId,
        previousStatus: 'CONFIRMED',
        newStatus: 'SHIPPED',
        changedById: user.id,
        note: `Dispatched to ${carrierName.toUpperCase()}. AWB: ${result.trackingNumber}`
      }
    })

    // Log activity
    await logActivity(
      user.id,
      user.role,
      'CARRIER_DISPATCH',
      `Dispatched order ${order.trackingNumber} to ${carrierName.toUpperCase()}. AWB: ${result.trackingNumber}`
    )

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      carrier: carrierName.toUpperCase(),
      trackingNumber: result.trackingNumber,
      labelUrl: result.labelUrl
    })
  } catch (error) {
    console.error('Carrier dispatch error:', error)
    return NextResponse.json({ error: 'Dispatch failed', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

/**
 * Dispatch order to specific carrier API
 * This is a placeholder - actual implementation depends on carrier API specs
 */
async function dispatchToCarrier(
  carrierName: string,
  carrierSettings: any,
  order: any
): Promise<{ trackingNumber: string; labelUrl: string }> {
  // This is where you would implement actual carrier API calls
  // Each carrier has different API requirements

  const trackingNumber = generateTrackingNumber(carrierName, order)
  const labelUrl = `https://example.com/labels/${trackingNumber}.pdf` // Placeholder

  // TODO: Implement actual carrier API calls
  // - Shipsen: https://api.shipsen.com/...
  // - ColisSwift: https://api.colisswift.com/...
  // - AfriqueCod: https://api.afriquecod.com/...

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))

  return { trackingNumber, labelUrl }
}

function generateTrackingNumber(carrierName: string, order: any): string {
  const timestamp = Date.now().toString(36).substring(0, 10).toUpperCase()
  const carrierPrefix = carrierName.substring(0, 3).toUpperCase()
  return `${carrierPrefix}-${timestamp}`
}
