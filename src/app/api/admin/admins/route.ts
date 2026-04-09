import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminSession, requireAdminPermission, hashAdminPassword, generateRandomPassword, checkPermission } from '@/lib/admin-auth'
import { logAction, AUDIT_ACTIONS } from '@/lib/audit-logger'

// GET /api/admin/admins - List all admins
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const permissionCheck = checkPermission(session.role as any, 'staff:manage')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } }
      ]
    }

    if (role) {
      where.role = role
    }

    if (status) {
      where.status = status
    }

    const [admins, total] = await Promise.all([
      db.admin.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          lastLoginAt: true,
          forcePasswordChange: true,
          createdAt: true,
          createdBy: true,
          _count: {
            select: {
              auditLogs: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit
      }),
      db.admin.count({ where })
    ])

    return NextResponse.json({
      admins,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('List admins error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/admins - Create a new admin
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only SUPER_ADMIN can create admins
    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { email, name, role, status } = body

    if (!email || !name || !role) {
      return NextResponse.json(
        { error: 'Email, name, and role are required' },
        { status: 400 }
      )
    }

    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existing = await db.admin.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    // Generate random password
    const generatedPassword = generateRandomPassword()
    const hashedPassword = await hashAdminPassword(generatedPassword)

    const admin = await db.admin.create({
      data: {
        email: email.toLowerCase(),
        name,
        role,
        status: status || 'ACTIVE',
        password: hashedPassword,
        forcePasswordChange: true,
        createdBy: session.adminId
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true
      }
    })

    // Log the action
    await logAction(
      session.adminId,
      session.name,
      session.role as any,
      {
        action: AUDIT_ACTIONS.USER_CREATED,
        targetType: 'Admin',
        targetId: admin.id,
        details: {
          before: {},
          after: { email: admin.email, name: admin.name, role: admin.role }
        }
      }
    )

    return NextResponse.json({
      admin,
      generatedPassword // Only returned once on creation
    })
  } catch (error) {
    console.error('Create admin error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
