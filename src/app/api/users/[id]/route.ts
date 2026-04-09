import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { withAuditContext } from '@/lib/api-context'

// PATCH /api/users/[id] - Admin only
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuditContext(async () => {
    try {
      const user = await getSession()
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      const { id } = await params
      const body = await request.json()
      const { isActive, role, name, phone } = body

      const updateData: Record<string, unknown> = {}
      if (isActive !== undefined) updateData.isActive = isActive
      if (role) updateData.role = role
      if (name) updateData.name = name
      if (phone !== undefined) updateData.phone = phone

      const updatedUser = await db.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          isActive: true
        }
      })

      return NextResponse.json({ user: updatedUser })
    } catch (error) {
      console.error('Update user error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}

// DELETE /api/users/[id] - Admin only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuditContext(async () => {
    try {
      const user = await getSession()
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      const { id } = await params

      // Prevent self-deletion
      if (id === user.id) {
        return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
      }

      await db.user.delete({ where: { id } })

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Delete user error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}
