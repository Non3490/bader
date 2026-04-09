import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminSession, hashAdminPassword, generateRandomPassword } from '@/lib/admin-auth'
import { logAction, AUDIT_ACTIONS } from '@/lib/audit-logger'

// POST /api/admin/admins/[id]/reset-password - Reset admin password
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only SUPER_ADMIN and ADMIN can reset passwords
    if (!['SUPER_ADMIN', 'ADMIN'].includes(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const admin = await db.admin.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Manager can only reset staff passwords, not other admins
    if (session.role === 'ADMIN' && ['SUPER_ADMIN', 'ADMIN'].includes(admin.role as any)) {
      return NextResponse.json(
        { error: 'Cannot reset admin passwords' },
        { status: 403 }
      )
    }

    // Generate new random password
    const newPassword = generateRandomPassword()
    const hashedPassword = await hashAdminPassword(newPassword)

    await db.admin.update({
      where: { id: params.id },
      data: {
        password: hashedPassword,
        forcePasswordChange: true
      }
    })

    // Log the action
    await logAction(
      session.adminId,
      session.name,
      session.role as any,
      {
        action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
        targetType: 'Admin',
        targetId: admin.id,
        details: {
          before: { email: admin.email },
          after: { forcePasswordChange: true }
        }
      }
    )

    return NextResponse.json({
      success: true,
      newPassword // Only returned once
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
