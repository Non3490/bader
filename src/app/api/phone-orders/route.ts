import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/phone-orders - Get phone orders for current agent/seller
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'SELLER')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')

    const twoHoursAgo = new Date()
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)

    const orders = await db.order.findMany({
      where: {
        source: 'PHONE',
        createdAt: { gte: twoHoursAgo }
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json({
      orders: orders.map(order => ({
        id: order.id,
        trackingNumber: order.trackingNumber,
        recipientName: order.recipientName,
        phone: order.phone,
        address: order.address,
        city: order.city,
        codAmount: order.codAmount,
        status: order.status,
        note: order.note,
        source: order.source,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map(item => ({
          name: item.product.name,
          sku: item.product.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      }))
    })
  } catch (error) {
    console.error('Get phone orders error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/phone-orders - Create a new phone order
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'SELLER')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      customerId,
      customerPhone,
      recipientName,
      address,
      city,
      items,
      orderType,
      paymentMethod,
      discountCode,
      notes,
      codAmount
    } = body as {
      customerId?: string
      customerPhone: string
      recipientName: string
      address: string
      city: string
      items: Array<{ productId: string; quantity: number; unitPrice: number }>
      orderType: 'DELIVERY' | 'PICKUP'
      paymentMethod: 'CASH' | 'CARD' | 'ONLINE'
      discountCode?: string
      notes?: string
      codAmount: number
    }

    // Validate required fields
    if (!customerPhone || !recipientName || !address || !city || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: phone, name, address, city, items' },
        { status: 400 }
      )
    }

    // Create or find customer
    let customer = customerId
      ? await db.customer.findUnique({ where: { id: customerId } })
      : null

    if (!customer) {
      // Check if customer exists by phone
      const existingCustomer = await db.customer.findUnique({
        where: { phone: customerPhone }
      })

      if (existingCustomer) {
        customer = existingCustomer
      } else {
        // Create new customer
        customer = await db.customer.create({
          data: {
            phone: customerPhone,
            deliveryRate: 0,
            orderCount: 0,
            deliveredCount: 0
          }
        })
      }
    }

    // Generate tracking number
    const timestamp = Date.now().toString(36).toUpperCase()
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase()
    const trackingNumber = `PH-${timestamp}-${randomStr}`

    // Calculate total amount from items
    const itemsTotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)

    // Create order with PHONE source
    const order = await db.order.create({
      data: {
        trackingNumber,
        sellerId: user.id,
        recipientName,
        phone: customerPhone,
        address,
        city,
        codAmount: codAmount || itemsTotal,
        status: 'NEW',
        source: 'PHONE',
        note: notes || null,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        },
        // If discount code provided, store it in note for now (can be enhanced later)
        note: discountCode
          ? `Discount Code: ${discountCode}${notes ? '. ' + notes : ''}`
          : notes || null
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    })

    // Update customer order count
    await db.customer.update({
      where: { id: customer.id },
      data: {
        orderCount: { increment: 1 }
      }
    })

    // Log the activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        role: user.role,
        action: 'PHONE_ORDER_CREATED',
        details: JSON.stringify({
          orderId: order.id,
          trackingNumber: order.trackingNumber,
          customerPhone: customerPhone,
          itemCount: items.length
        })
      }
    })

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        trackingNumber: order.trackingNumber,
        recipientName: order.recipientName,
        phone: order.phone,
        address: order.address,
        city: order.city,
        codAmount: order.codAmount,
        status: order.status,
        source: order.source,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map(item => ({
          productId: item.productId,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Create phone order error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
