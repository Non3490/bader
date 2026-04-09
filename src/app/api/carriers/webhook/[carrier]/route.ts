import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

/**
 * POST /api/carriers/webhook/[carrier]
 * Receive status updates from carrier webhooks
 * PUBLIC endpoint (called by carrier)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ carrier: string }> }
) {
  const { carrier } = await params

  try {
    const body = await request.json()

    // Get carrier settings for validation
    const carrierSettings = await db.carrierSettings.findFirst({
      where: {
        name: carrier.toLowerCase(),
        isActive: true
      }
    })

    if (!carrierSettings) {
      return NextResponse.json({ error: 'Carrier not configured' }, { status: 404 })
    }

    // Validate webhook signature if carrier provides it
    const signature = request.headers.get('x-webhook-signature')
    const expectedSecret = process.env.CARRIER_WEBHOOK_SECRET
    if (!signature || signature !== expectedSecret) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Get tracking number from body
    const trackingNumber = body.tracking_number || body.awb || body.trackingNumber

    if (!trackingNumber) {
      return NextResponse.json({ error: 'Missing tracking number' }, { status: 400 })
    }

    // Map carrier status to platform OrderStatus
    const statusMap: Record<string, string> = {
      'delivered': 'DELIVERED',
      'out_for_delivery': 'SHIPPED',
      'in_transit': 'SHIPPED',
      'shipped': 'SHIPPED',
      'returned': 'RETURNED',
      'rejected': 'RETURNED',
      'cancelled': 'CANCELLED'
    }

    const newStatus = statusMap[body.status?.toLowerCase()] || 'SHIPPED'

    // Find order by tracking number
    const order = await db.order.findFirst({
      where: { awbTrackingCode: trackingNumber }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Skip if already has this status
    if (order.status === newStatus) {
      return NextResponse.json({ success: true, message: 'Order already has this status' })
    }

    // Update order status
    await db.order.update({
      where: { id: order.id },
      data: {
        status: newStatus,
        ...(newStatus === 'DELIVERED' && { deliveredAt: new Date() }),
        ...(newStatus === 'RETURNED' && { returnedAt: new Date() })
      }
    })

    // Create order history entry (with SYSTEM user ID for webhooks)
    await db.orderHistory.create({
      data: {
        orderId: order.id,
        previousStatus: order.status,
        newStatus,
        changedById: 'SYSTEM', // Webhook updates marked as SYSTEM
        note: `Carrier webhook update: ${carrier.toUpperCase()} - ${body.status}`
      }
    })

    // Log activity
    await logActivity(
      'SYSTEM',
      'SYSTEM',
      'CARRIER_WEBHOOK',
      `Carrier ${carrier.toUpperCase()} updated order ${order.trackingNumber} to ${newStatus}`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Carrier webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
