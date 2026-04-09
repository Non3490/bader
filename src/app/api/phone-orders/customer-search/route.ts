import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/phone-orders/customer-search?phone=...
// Search customer by phone number with partial matching support
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

    // Search for customers with phone containing the search digits (partial match)
    const customers = await db.customer.findMany({
      where: {
        phone: {
          contains: cleanPhone
        }
      },
      take: 10
    })

    // If no customers found, return empty array
    if (customers.length === 0) {
      return NextResponse.json({ customers: [], found: false })
    }

    // Get recent orders for each customer
    const customersWithOrders = await Promise.all(
      customers.map(async (customer) => {
        const recentOrders = await db.order.findMany({
          where: { phone: customer.phone },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            trackingNumber: true,
            recipientName: true,
            codAmount: true,
            status: true,
            source: true,
            createdAt: true,
            city: true,
            address: true,
            items: {
              select: {
                product: {
                  select: {
                    name: true
                  }
                },
                quantity: true
              }
            }
          }
        })

        return {
          id: customer.id,
          phone: customer.phone,
          deliveryRate: customer.deliveryRate,
          orderCount: customer.orderCount,
          deliveredCount: customer.deliveredCount,
          recentOrders: recentOrders.map(order => ({
            id: order.id,
            trackingNumber: order.trackingNumber,
            recipientName: order.recipientName,
            codAmount: order.codAmount,
            status: order.status,
            source: order.source,
            createdAt: order.createdAt.toISOString(),
            city: order.city,
            address: order.address,
            itemNames: order.items.map(item => `${item.product.name} x${item.quantity}`).join(', ')
          }))
        }
      })
    )

    return NextResponse.json({
      customers: customersWithOrders,
      found: true
    })
  } catch (error) {
    console.error('Customer search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
