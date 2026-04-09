import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// Valid discount reasons
const DISCOUNT_REASONS = [
  'LATE_DELIVERY',
  'WRONG_ITEM',
  'COMPLAINT_RESOLUTION',
  'LOYALTY',
  'MANAGER_OVERRIDE',
  'OTHER'
] as const

type DiscountReason = typeof DISCOUNT_REASONS[number]

// POST /api/discounts/apply - Apply discount with reason tracking
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'SELLER')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, discountAmount, reason, notes } = body as {
      orderId: string
      discountAmount: number
      reason: string
      notes?: string
    }

    if (!orderId || discountAmount === undefined || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, discountAmount, reason' },
        { status: 400 }
      )
    }

    // Validate discount reason
    if (!DISCOUNT_REASONS.includes(reason as DiscountReason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${DISCOUNT_REASONS.join(', ')}` },
        { status: 400 }
      )
    }

    // Check for Manager Override - requires Manager or higher role
    if (reason === 'MANAGER_OVERRIDE' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      // Check if user is manager based on Admin model if exists
      const adminUser = await db.admin.findUnique({
        where: { email: user.email }
      })

      if (!adminUser || adminUser.role !== 'MANAGER') {
        return NextResponse.json(
          { error: 'Manager Override requires Manager or Admin role' },
          { status: 403 }
        )
      }
    }

    // Verify order exists
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        codAmount: true,
        note: true
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Validate discount amount
    if (discountAmount < 0 || discountAmount > order.codAmount) {
      return NextResponse.json(
        { error: 'Discount amount must be between 0 and order COD amount' },
        { status: 400 }
      )
    }

    // Apply discount by updating COD amount
    const newCodAmount = order.codAmount - discountAmount

    await db.order.update({
      where: { id: orderId },
      data: {
        codAmount: newCodAmount,
        // Append discount info to note
        note: order.note
          ? `${order.note}\n\nDISCOUNT APPLIED: ${discountAmount} FCFA - Reason: ${reason}${notes ? ` (${notes})` : ''}`
          : `DISCOUNT APPLIED: ${discountAmount} FCFA - Reason: ${reason}${notes ? ` (${notes})` : ''}`
      }
    })

    // Log the discount application for audit
    await db.activityLog.create({
      data: {
        userId: user.id,
        role: user.role,
        action: 'DISCOUNT_APPLIED',
        details: JSON.stringify({
          orderId,
          discountAmount,
          reason,
          notes,
          previousCodAmount: order.codAmount,
          newCodAmount
        })
      }
    })

    return NextResponse.json({
      success: true,
      discount: {
        orderId,
        discountAmount,
        reason,
        previousCodAmount: order.codAmount,
        newCodAmount
      }
    })
  } catch (error) {
    console.error('Apply discount error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/discounts/apply - Get valid discount reasons
export async function GET() {
  return NextResponse.json({
    reasons: DISCOUNT_REASONS.map(reason => ({
      value: reason,
      label: reason.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
    }))
  })
}
