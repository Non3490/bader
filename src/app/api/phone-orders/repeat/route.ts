import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/phone-orders/repeat?customerId=... - Get last order for quick reorder
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'SELLER')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customerId')
    const customerPhone = searchParams.get('phone')

    if (!customerId && !customerPhone) {
      return NextResponse.json(
        { error: 'Customer ID or phone number is required' },
        { status: 400 }
      )
    }

    // Find the customer's last order
    const lastOrder = await db.order.findFirst({
      where: customerId
        ? { phone: customerPhone || undefined }
        : { phone: customerPhone || undefined },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                sellPrice: true,
                isActive: true
              }
            }
          }
        }
      }
    })

    if (!lastOrder) {
      return NextResponse.json({ found: false, message: 'No previous orders found' })
    }

    // Filter items to only include active products
    const availableItems = lastOrder.items.filter(item => item.product.isActive)

    return NextResponse.json({
      found: true,
      order: {
        id: lastOrder.id,
        trackingNumber: lastOrder.trackingNumber,
        recipientName: lastOrder.recipientName,
        phone: lastOrder.phone,
        address: lastOrder.address,
        city: lastOrder.city,
        codAmount: lastOrder.codAmount,
        items: availableItems.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          sku: item.product.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        })),
        orderDate: lastOrder.createdAt.toISOString()
      }
    })
  } catch (error) {
    console.error('Get last order error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
