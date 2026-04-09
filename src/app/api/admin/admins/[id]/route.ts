import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminSession, checkPermission } from '@/lib/admin-auth'
import { logAction, AUDIT_ACTIONS } from '@/lib/audit-logger'

// GET /api/admin/admins/[id] - Get a single admin
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const permissionCheck = checkPermission(session.role as any, 'audit:view')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const admin = await db.admin.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        lastLoginAt: true,
        forcePasswordChange: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        auditLogs: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            action: true,
            targetType: true,
            targetId: true,
            details: true,
            createdAt: true
          }
        }
      }
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    return NextResponse.json({ admin })
  } catch (error) {
    console.error('Get admin error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/admins/[id] - Update an admin
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only SUPER_ADMIN can update admins
    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const existing = await db.admin.findUnique({
      where: { id: params.id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Prevent self-deactivation or role change
    if (existing.id === session.adminId) {
      return NextResponse.json(
        { error: 'Cannot modify your own account' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, role, status, forcePasswordChange } = body

    const updateData: Record<string, unknown> = {}
    const beforeData: Record<string, unknown> = {}
    const afterData: Record<string, unknown> = {}

    if (name !== undefined) {
      beforeData.name = existing.name
      afterData.name = name
      updateData.name = name
    }

    if (role !== undefined && ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role)) {
      beforeData.role = existing.role
      afterData.role = role
      updateData.role = role
    }

    if (status !== undefined && ['ACTIVE', 'INACTIVE', 'LOCKED'].includes(status)) {
      beforeData.status = existing.status
      afterData.status = status
      updateData.status = status
    }

    if (forcePasswordChange !== undefined) {
      beforeData.forcePasswordChange = existing.forcePasswordChange
      afterData.forcePasswordChange = forcePasswordChange
      updateData.forcePasswordChange = forcePasswordChange
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const admin = await db.admin.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        lastLoginAt: true,
        forcePasswordChange: true,
        updatedAt: true
      }
    })

    // Log the action
    await logAction(
      session.adminId,
      session.name,
      session.role as any,
      {
        action: AUDIT_ACTIONS.USER_UPDATED,
        targetType: 'Admin',
        targetId: admin.id,
        details: {
          before: beforeData,
          after: afterData
        }
      }
    )

    return NextResponse.json({ admin })
  } catch (error) {
    console.error('Update admin error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/admins/[id] - Delete an admin
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only SUPER_ADMIN can delete admins
    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const existing = await db.admin.findUnique({
      where: { id: params.id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Prevent self-deletion
    if (existing.id === session.adminId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    await db.admin.delete({
      where: { id: params.id }
    })

    // Log the action
    await logAction(
      session.adminId,
      session.name,
      session.role as any,
      {
        action: AUDIT_ACTIONS.USER_DEACTIVATED,
        targetType: 'Admin',
        targetId: params.id,
        details: {
          before: { email: existing.email, name: existing.name, role: existing.role },
          after: {}
        }
      }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete admin error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
