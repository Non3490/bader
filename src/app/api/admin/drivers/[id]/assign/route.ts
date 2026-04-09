/**
 * Manually Assign Order to Driver
 * POST /api/admin/drivers/[id]/assign
 * Body: { orderId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAuth()
    if (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    const driverId = params.id
    const body = await request.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Check if driver exists and is active
    const driver = await db.driver.findUnique({
      where: { id: driverId }
    })

    if (!driver || !driver.isActive) {
      return NextResponse.json(
        { error: 'Driver not found or inactive' },
        { status: 404 }
      )
    }

    // Check if order exists and is in SHIPPED status
    const order = await db.order.findUnique({
      where: { id: orderId }
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    if (order.status !== 'SHIPPED') {
      return NextResponse.json(
        { error: 'Order must be in SHIPPED status to assign' },
        { status: 400 }
      )
    }

    // Check if order already has a delivery record
    const existingDelivery = await db.delivery.findUnique({
      where: { orderId }
    })

    if (existingDelivery) {
      return NextResponse.json(
        { error: 'Order is already assigned to a driver' },
        { status: 400 }
      )
    }

    // Create delivery record
    const delivery = await db.delivery.create({
      data: {
        orderId,
        driverId,
        status: 'ASSIGNED',
        assignedAt: new Date()
      },
      include: {
        order: {
          select: {
            trackingNumber: true,
            recipientName: true,
            address: true,
            city: true
          }
        }
      }
    })

    // Update order with assigned driver
    await db.order.update({
      where: { id: orderId },
      data: { assignedDriverId: driverId }
    })

    return NextResponse.json({
      success: true,
      delivery
    })

  } catch (error: any) {
    console.error('Assign order error:', error)
    return NextResponse.json(
      { error: 'Failed to assign order' },
      { status: 500 }
    )
  }
}
