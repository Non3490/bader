import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { assignOrderToDeliveryZone } from '@/lib/zone-assigner'

// POST /api/admin/delivery-zones/retry-assign
// Retry auto-assignment for a specific order with updated address
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { orderId, address, city } = body

    if (!orderId || !address || !city) {
      return NextResponse.json({ error: 'orderId, address, and city are required' }, { status: 400 })
    }

    // Check if order exists and is not already assigned
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { id: true, deliveryManId: true, deliveryZoneId: true }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.deliveryManId) {
      return NextResponse.json({ error: 'Order is already assigned to a driver' }, { status: 400 })
    }

    // Try to assign to delivery zone
    const result = await assignOrderToDeliveryZone(orderId, address, city)

    if (result.success) {
      // Get driver name for response
      const driver = await db.user.findUnique({
        where: { id: result.driverId! },
        select: { name: true }
      })

      return NextResponse.json({
        success: true,
        zoneId: result.zoneId,
        driverId: result.driverId,
        driverName: driver?.name || 'Unknown'
      })
    } else {
      return NextResponse.json({ success: false, error: 'Address not found in any zone' })
    }
  } catch (error) {
    console.error('Retry assign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
