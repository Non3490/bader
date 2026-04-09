import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

// PATCH /api/team/[id] — toggle isActive or update
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { id } = await params
    const target = await db.user.findUnique({ where: { id }, select: { parentSellerId: true, name: true } })
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Only the parent seller or admin can modify
    if (target.parentSellerId !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { isActive } = await request.json()
    const updated = await db.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true }
    })

    logActivity(user.id, user.role, 'TEAM_MEMBER_UPDATED', `${target.name} isActive=${isActive}`).catch(() => {})
    return NextResponse.json({ member: updated })
  } catch (error) {
    console.error('Team PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/team/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { id } = await params
    const target = await db.user.findUnique({ where: { id }, select: { parentSellerId: true, name: true } })
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (target.parentSellerId !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    await db.user.delete({ where: { id } })
    logActivity(user.id, user.role, 'TEAM_MEMBER_REMOVED', `${target.name}`).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Team DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
