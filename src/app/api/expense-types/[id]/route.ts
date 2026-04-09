import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

// PATCH /api/expense-types/[id] - Toggle expense type active status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { isActive } = body

    if (isActive === undefined) {
      return NextResponse.json({ error: 'isActive is required' }, { status: 400 })
    }

    const expenseType = await db.expenseType.update({
      where: { id },
      data: { isActive }
    })

    await logActivity(user.id, user.role, 'EXPENSE_TYPE_TOGGLED', `Expense type set to ${isActive ? 'active' : 'inactive'}`)

    return NextResponse.json({ expenseType })
  } catch (error) {
    console.error('Toggle expense type error:', error)
    return NextResponse.json({ error: 'Failed to update expense type' }, { status: 500 })
  }
}

// DELETE /api/expense-types/[id] - Delete expense type
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { id } = await params

    // Check if expense type is being used
    const inUse = await db.expense.count({
      where: { expenseTypeId: id }
    })

    if (inUse > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${inUse} expense(s) reference this type` },
        { status: 400 }
      )
    }

    await db.expenseType.delete({ where: { id } })

    await logActivity(user.id, user.role, 'EXPENSE_TYPE_DELETED', `Expense type deleted`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete expense type error:', error)
    return NextResponse.json({ error: 'Failed to delete expense type' }, { status: 500 })
  }
}
