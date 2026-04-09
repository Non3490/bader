import { NextRequest, NextResponse } from 'next/server'
import { isSameDay } from 'date-fns'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user || user.role !== 'CALL_CENTER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const expense = await db.expense.findFirst({
      where: { id, agentId: user.id }
    })

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    if (!isSameDay(expense.incurredAt, new Date())) {
      return NextResponse.json({ error: 'Only today expenses can be deleted' }, { status: 400 })
    }

    await db.expense.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
