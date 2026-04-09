import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

/**
 * DELETE /api/blacklist/[id]
 * Remove a phone number from blacklist by ID
 * ADMIN only
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const { id } = await params

    const existing = await db.blacklist.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Blacklist entry not found' }, { status: 404 })
    }

    await db.blacklist.update({
      where: { id },
      data: {
        isActive: false,
        removedAt: new Date(),
        removedBy: user.id
      }
    })

    await logActivity(
      user.id,
      user.role,
      'BLACKLIST_REMOVE',
      `Removed ${existing.phone} from blacklist`
    )

    return NextResponse.json({ success: true, message: 'Phone number removed from blacklist' })
  } catch (error) {
    console.error('Error removing from blacklist:', error)
    return NextResponse.json({ error: 'Failed to remove from blacklist' }, { status: 500 })
  }
}
