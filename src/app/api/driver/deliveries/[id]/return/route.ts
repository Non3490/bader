/**
 * Mark Delivery as Returned
 * POST /api/driver/deliveries/[id]/return
 * Body: { reason: 'CUSTOMER_REFUSED' | 'NOT_HOME' | 'WRONG_ADDRESS' | 'DAMAGED' | 'OTHER', notes?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireDriverAuth } from '@/lib/driver-auth'
import { db } from '@/lib/db'

const RETURN_REASONS = [
  'CUSTOMER_REFUSED',
  'NOT_HOME',
  'WRONG_ADDRESS',
  'DAMAGED',
  'OTHER'
]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const driver = await requireDriverAuth()
    let deliveryId = id
    const body = await request.json()
    const { reason, notes, gpsLat, gpsLng } = body

    // Validate return reason
    if (!reason || !RETURN_REASONS.includes(reason)) {
      return NextResponse.json(
        { error: 'Invalid return reason', validReasons: RETURN_REASONS },
        { status: 400 }
      )
    }

    // Handle legacy IDs (orders assigned via old system without Delivery records)
    if (deliveryId.startsWith('legacy-')) {
      const orderId = deliveryId.replace('legacy-', '')
      const existingDelivery = await db.delivery.findUnique({ where: { orderId } })
      if (existingDelivery) {
        deliveryId = existingDelivery.id
      } else {
        // Create Delivery record first
        const newDelivery = await db.delivery.create({
          data: { orderId, driverId: driver.id, status: 'IN_TRANSIT', inTransitAt: new Date() }
        })
        deliveryId = newDelivery.id
        await db.order.update({ where: { id: orderId }, data: { assignedDriverId: driver.id } })
      }
    }

    // Get current delivery
    const delivery = await db.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true }
    })

    if (!delivery) {
      return NextResponse.json(
        { error: 'Delivery not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (delivery.driverId !== driver.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Can only return from IN_TRANSIT status
    if (delivery.status !== 'IN_TRANSIT') {
      return NextResponse.json(
        { error: 'Can only return deliveries that are in transit' },
        { status: 400 }
      )
    }

    // Update delivery as returned
    const updatedDelivery = await db.delivery.update({
      where: { id: deliveryId },
      data: {
        status: 'RETURNED',
        returnReason: reason,
        returnNotes: notes || null,
        returnedAt: new Date(),
        gpsDeliveryLat: gpsLat,
        gpsDeliveryLng: gpsLng,
        updatedAt: new Date()
      },
      include: {
        order: {
          select: {
            id: true,
            trackingNumber: true,
            recipientName: true,
            phone: true,
            address: true,
            city: true,
            note: true,
            codAmount: true,
            status: true,
            items: {
              select: {
                quantity: true,
                product: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    })

    // Update order status
    await db.order.update({
      where: { id: delivery.orderId },
      data: {
        status: 'RETURNED',
        returnedAt: new Date()
      }
    })

    // Note: No notification sent for returned orders (admin handles manually)

    return NextResponse.json({ delivery: updatedDelivery })

  } catch (error: any) {
    if (error.message === 'DRIVER_NOT_AUTHENTICATED') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    console.error('Return delivery error:', error)
    return NextResponse.json(
      { error: 'Failed to mark as returned' },
      { status: 500 }
    )
  }
}
