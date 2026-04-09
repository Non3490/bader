/**
 * Get Unassigned SHIPPED Orders
 * GET /api/admin/orders-unshipped
 * Returns orders in SHIPPED status that haven't been assigned to a driver yet
 * Useful for manual assignment when auto-assignment fails (no available drivers)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const orders = await db.order.findMany({
      where: {
        status: 'SHIPPED',
        assignedDriverId: null,
        delivery: null // No delivery record exists
      },
      select: {
        id: true,
        trackingNumber: true,
        recipientName: true,
        phone: true,
        address: true,
        city: true,
        codAmount: true,
        shippedAt: true,
        createdAt: true,
        seller: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Also get available drivers count
    const availableDriversCount = await db.driver.count({
      where: {
        status: 'AVAILABLE',
        isActive: true
      }
    })

    return NextResponse.json({
      orders,
      summary: {
        total: orders.length,
        availableDrivers: availableDriversCount
      }
    })

  } catch (error: any) {
    console.error('Get unassigned SHIPPED orders error:', error)
    return NextResponse.json(
      { error: 'Failed to get unassigned orders' },
      { status: 500 }
    )
  }
}
