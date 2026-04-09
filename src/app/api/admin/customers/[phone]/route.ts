import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, checkPermission } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { logAction, AUDIT_ACTIONS } from '@/lib/audit-logger'

// GET /api/admin/customers/[phone] - Get customer details
export async function GET(
  request: NextRequest,
  { params }: { params: { phone: string } }
) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = checkPermission(session.role as any, 'customers:view')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const phone = decodeURIComponent(params.phone)

    const customer = await db.customer.findUnique({
      where: { phone }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Get customer orders
    const orders = await db.order.findMany({
      where: { phone },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // Check blacklist status
    const blacklist = await db.blacklist.findUnique({
      where: { phone }
    })

    const totalSpent = orders
      .filter(o => o.status === 'DELIVERED')
      .reduce((sum, o) => sum + o.codAmount, 0)

    return NextResponse.json({
      customer: {
        ...customer,
        isBlocked: !!blacklist?.isActive,
        blacklistReason: blacklist?.reason,
        blacklistDate: blacklist?.createdAt,
        isVip: customer.orderCount >= 10,
        totalSpent,
        orders
      }
    })
  } catch (error) {
    console.error('Get customer error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/customers/[phone] - Update customer
export async function PUT(
  request: NextRequest,
  { params }: { params: { phone: string } }
) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = checkPermission(session.role as any, 'customers:manage')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const phone = decodeURIComponent(params.phone)
    const body = await request.json()
    const { deliveryRate, isBlocked, blockReason } = body

    const customer = await db.customer.findUnique({
      where: { phone }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Update customer
    const updated = await db.customer.update({
      where: { phone },
      data: {
        ...(deliveryRate !== undefined && { deliveryRate })
      }
    })

    // Handle blacklist
    if (isBlocked) {
      await db.blacklist.upsert({
        where: { phone },
        create: {
          phone,
          reason: blockReason || 'Blocked by admin',
          autoFlagged: false,
          isActive: true
        },
        update: {
          isActive: true,
          removedAt: null,
          ...(blockReason && { reason: blockReason })
        }
      })

      await logAction(
        session.adminId,
        session.name,
        session.role as any,
        {
          action: AUDIT_ACTIONS.CUSTOMER_BLOCKED,
          targetType: 'Customer',
          targetId: customer.id,
          details: {
            phone,
            reason: blockReason
          }
        }
      )
    } else if (isBlocked === false) {
      await db.blacklist.updateMany({
        where: { phone },
        data: {
          isActive: false,
          removedAt: new Date()
        }
      })
    }

    return NextResponse.json({
      success: true,
      customer: updated
    })
  } catch (error) {
    console.error('Update customer error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/customers/[phone] - Delete customer (soft delete via blacklist)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { phone: string } }
) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = checkPermission(session.role as any, 'customers:manage')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const phone = decodeURIComponent(params.phone)

    // For now, we don't actually delete customers - we just block them
    // If you want to implement actual deletion, you would need to handle related orders

    await db.blacklist.upsert({
      where: { phone },
      create: {
        phone,
        reason: 'Deleted by admin',
        autoFlagged: false,
        isActive: true
      },
      update: {
        isActive: true,
        removedAt: null,
        reason: 'Deleted by admin'
      }
    })

    await logAction(
      session.adminId,
      session.name,
      session.role as any,
      {
        action: AUDIT_ACTIONS.CUSTOMER_BLOCKED,
        targetType: 'Customer',
        targetId: phone,
        details: {
          phone,
          action: 'deleted'
        }
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Customer blocked successfully'
    })
  } catch (error) {
    console.error('Delete customer error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
