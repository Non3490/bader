import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/phone-orders/status-check?phone=...
// Quick order status check by phone number
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'SELLER')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const phone = searchParams.get('phone')

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    // Strip non-digit characters for matching
    const cleanPhone = phone.replace(/\D/g, '')

    // Get all orders for this phone number
    const orders = await db.order.findMany({
      where: {
        phone: {
          contains: cleanPhone
        }
      },
      include: {
        deliveryMan: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    if (orders.length === 0) {
      return NextResponse.json({ found: false, message: 'No orders found for this phone number' })
    }

    // Format orders for status display
    const orderStatuses = orders.map(order => ({
      id: order.id,
      trackingNumber: order.trackingNumber,
      recipientName: order.recipientName,
      status: order.status,
      source: order.source,
      codAmount: order.codAmount,
      city: order.city,
      createdAt: order.createdAt.toISOString(),
      confirmedAt: order.confirmedAt?.toISOString(),
      shippedAt: order.shippedAt?.toISOString(),
      deliveredAt: order.deliveredAt?.toISOString(),
      // If with driver, show driver info
      ...(order.deliveryMan && {
        deliveryMan: {
          name: order.deliveryMan.name,
          phone: order.deliveryMan.phone
        }
      }),
      // For delivery orders, show delivery status
      ...(order.status === 'SHIPPED' && {
        deliveryStatus: 'Out for delivery',
        lastUpdate: order.shippedAt || order.updatedAt
      })
    }))

    // Count orders by status
    const statusSummary = {
      total: orders.length,
      new: orders.filter(o => o.status === 'NEW').length,
      confirmed: orders.filter(o => o.status === 'CONFIRMED').length,
      shipped: orders.filter(o => o.status === 'SHIPPED').length,
      delivered: orders.filter(o => o.status === 'DELIVERED').length,
      returned: orders.filter(o => o.status === 'RETURNED').length,
      cancelled: orders.filter(o => o.status === 'CANCELLED').length,
      other: orders.filter(o =>
        !['NEW', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED'].includes(o.status)
      ).length
    }

    return NextResponse.json({
      found: true,
      phone: cleanPhone,
      statusSummary,
      orders: orderStatuses
    })
  } catch (error) {
    console.error('Order status check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
