/**
 * End Driver Shift and Create Cash Handoff
 * POST /api/driver/end-shift
 * Body: { deliveries: [{ id: string, codCollected: number }] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireDriverAuth } from '@/lib/driver-auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const driver = await requireDriverAuth()
    const body = await request.json()
    const { deliveries } = body

    // Get all completed deliveries for today that haven't been handoff'd yet
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const completedDeliveries = await db.delivery.findMany({
      where: {
        driverId: driver.id,
        status: 'DELIVERED',
        createdAt: { gte: today },
        cashHandoffId: null // Not yet handoff'd
      },
      include: {
        order: {
          select: {
            id: true,
            trackingNumber: true,
            codAmount: true
          }
        }
      }
    })

    // Calculate totals
    const deliveryCount = completedDeliveries.length
    const totalCollected = completedDeliveries.reduce((sum, d) => {
      // Use the codCollected from delivery record, or fallback to order's codAmount
      return sum + (d.codCollected ?? d.order.codAmount)
    }, 0)

    // Update driver status to OFFLINE
    await db.driver.update({
      where: { id: driver.id },
      data: { status: 'OFFLINE' }
    })

    // Create cash handoff record
    const cashHandoff = await db.cashHandoff.create({
      data: {
        driverId: driver.id,
        shiftDate: new Date(),
        totalCollected,
        deliveryCount,
        status: 'PENDING'
      }
    })

    // Link deliveries to this handoff (if we had cashHandoffId in Delivery model)
    // For now, we'll track this association differently

    return NextResponse.json({
      success: true,
      cashHandoff: {
        id: cashHandoff.id,
        totalCollected,
        deliveryCount,
        status: cashHandoff.status,
        shiftDate: cashHandoff.shiftDate
      }
    })

  } catch (error: any) {
    if (error.message === 'DRIVER_NOT_AUTHENTICATED') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    console.error('End shift error:', error)
    return NextResponse.json(
      { error: 'Failed to end shift' },
      { status: 500 }
    )
  }
}

/**
 * Get Driver's Cash Summary (before ending shift)
 * GET /api/driver/end-shift
 */
export async function GET() {
  try {
    const driver = await requireDriverAuth()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const completedDeliveries = await db.delivery.findMany({
      where: {
        driverId: driver.id,
        status: 'DELIVERED',
        createdAt: { gte: today }
      },
      include: {
        order: {
          select: {
            trackingNumber: true,
            codAmount: true
          }
        }
      }
    })

    const deliveryCount = completedDeliveries.length
    const totalCollected = completedDeliveries.reduce((sum, d) => {
      return sum + (d.codCollected ?? d.order.codAmount)
    }, 0)

    return NextResponse.json({
      deliveryCount,
      totalCollected,
      deliveries: completedDeliveries
    })

  } catch (error: any) {
    if (error.message === 'DRIVER_NOT_AUTHENTICATED') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    console.error('Get cash summary error:', error)
    return NextResponse.json(
      { error: 'Failed to get cash summary' },
      { status: 500 }
    )
  }
}
