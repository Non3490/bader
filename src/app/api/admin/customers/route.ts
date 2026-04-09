import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, checkPermission } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { logAction, AUDIT_ACTIONS } from '@/lib/audit-logger'

// GET /api/admin/customers - Get all customers with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = checkPermission(session.role as any, 'customers:view')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status') // 'active', 'blocked', 'vip'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const exportCsv = searchParams.get('export') === 'true'

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { phone: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Customer status is stored in the User model or derived from other attributes
    // For now, we'll filter based on phone patterns (blacklisted phones)
    if (status === 'blocked') {
      // Get blacklisted phone numbers
      const blacklisted = await db.blacklist.findMany({
        where: { isActive: true },
        select: { phone: true }
      })
      const blacklistedPhones = new Set(blacklisted.map(b => b.phone))

      if (search) {
        // If searching, check if the search phone is in blacklist
        const isBlacklisted = await db.blacklist.findFirst({
          where: {
            phone: { contains: search },
            isActive: true
          }
        })
        if (!isBlacklisted) {
          return NextResponse.json({ customers: [], total: 0 })
        }
      }
    }

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: (page - 1) * limit
      }),
      db.customer.count({ where })
    ])

    // Get blacklist status for each customer
    const blacklistedPhones = await db.blacklist.findMany({
      where: { isActive: true },
      select: { phone: true }
    })
    const blacklistSet = new Set(blacklistedPhones.map(b => b.phone))

    const enrichedCustomers = await Promise.all(
      customers.map(async (customer) => {
        // Get orders for this customer
        const orders = await db.order.findMany({
          where: { phone: customer.phone },
          select: {
            id: true,
            status: true,
            codAmount: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        })

        const totalSpent = orders
          .filter(o => o.status === 'DELIVERED')
          .reduce((sum, o) => sum + o.codAmount, 0)

        return {
          ...customer,
          isBlocked: blacklistSet.has(customer.phone),
          isVip: customer.orderCount >= 10, // VIP threshold
          totalSpent,
          recentOrders: orders
        }
      })
    )

    if (exportCsv) {
      // Generate CSV
      const headers = ['Phone', 'Delivery Rate', 'Order Count', 'Delivered Count', 'Total Spent', 'Status', 'Blocked', 'VIP']
      const rows = enrichedCustomers.map(c => [
        c.phone,
        c.deliveryRate.toString(),
        c.orderCount.toString(),
        c.deliveredCount.toString(),
        c.totalSpent.toString(),
        'active',
        c.isBlocked ? 'Yes' : 'No',
        c.isVip ? 'Yes' : 'No'
      ])

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n')

      await logAction(
        session.adminId,
        session.name,
        session.role as any,
        {
          action: AUDIT_ACTIONS.DATA_EXPORTED,
          targetType: 'Customer',
          targetId: 'all',
          details: {
            type: 'customers',
            filters: { search, status },
            count: enrichedCustomers.length
          }
        }
      )

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="customers-${Date.now()}.csv"`
        }
      })
    }

    return NextResponse.json({
      customers: enrichedCustomers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('Get customers error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/customers - Create or update customer manually
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = checkPermission(session.role as any, 'customers:manage')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { phone, deliveryRate, isBlocked, isVip, notes } = body

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Normalize phone number
    const normalizedPhone = phone.replace(/\s+/g, '')

    // Check if customer exists
    const existing = await db.customer.findUnique({
      where: { phone: normalizedPhone }
    })

    let customer

    if (existing) {
      // Update existing customer
      customer = await db.customer.update({
        where: { phone: normalizedPhone },
        data: {
          deliveryRate: deliveryRate !== undefined ? deliveryRate : existing.deliveryRate
        }
      })
    } else {
      // Create new customer
      customer = await db.customer.create({
        data: {
          phone: normalizedPhone,
          deliveryRate: deliveryRate || 0,
          orderCount: 0,
          deliveredCount: 0
        }
      })
    }

    // Handle blacklist status
    if (isBlocked) {
      await db.blacklist.upsert({
        where: { phone: normalizedPhone },
        create: {
          phone: normalizedPhone,
          reason: notes || 'Manually blocked by admin',
          autoFlagged: false,
          isActive: true
        },
        update: {
          isActive: true,
          removedAt: null
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
            phone: normalizedPhone,
            reason: notes
          }
        }
      )
    } else if (isBlocked === false && existing) {
      // Unblock if explicitly set to false
      await db.blacklist.updateMany({
        where: { phone: normalizedPhone },
        data: {
          isActive: false,
          removedAt: new Date()
        }
      })
    }

    // VIP status is derived from order count, but we can store it in a note or separate field
    // For now, VIP is determined by orderCount >= 10

    return NextResponse.json({
      success: true,
      customer
    })
  } catch (error) {
    console.error('Create/Update customer error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
