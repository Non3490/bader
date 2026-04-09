import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

// DELETE /api/zones/[id] - Delete zone
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

    // Get zone info before deletion for logging
    const zone = await db.zone.findUnique({
      where: { id },
      select: { name: true, city: true }
    })

    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
    }

    await db.zone.delete({ where: { id } })

    await logActivity(user.id, user.role, 'ZONE_DELETED', `Zone "${zone.name}" in ${zone.city} deleted`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete zone error:', error)
    return NextResponse.json({ error: 'Failed to delete zone' }, { status: 500 })
  }
}
