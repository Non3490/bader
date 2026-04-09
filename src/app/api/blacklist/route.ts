import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getBlacklistStats } from '@/lib/blacklist-service'
import { withAuditContext } from '@/lib/api-context'

// GET /api/blacklist
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const search = request.nextUrl.searchParams.get('search')
    const where = search ? { phone: { contains: search }, isActive: true } : { isActive: true }

    const blacklist = await db.blacklist.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    // Get order statistics for each blacklisted phone
    const blacklistWithStats = await Promise.all(
      blacklist.map(async (entry) => {
        const stats = await getBlacklistStats(entry.phone)
        return {
          ...entry,
          orderCount: stats?.totalOrders ?? 0,
          confirmationRate: stats?.confirmationRate ?? 0,
          deliveryRate: stats?.deliveryRate ?? 0
        }
      })
    )

    return NextResponse.json({ blacklist: blacklistWithStats })
  } catch (error) {
    console.error('Get blacklist error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/blacklist - Add to blacklist
export async function POST(request: NextRequest) {
  return withAuditContext(async () => {
    try {
      const user = await getSession()
      if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

      if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 })
      }

      const body = await request.json()
      const { phone, reason, autoFlagged = true } = body

      if (!phone) {
        return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
      }

      // Check if already exists
      const existing = await db.blacklist.findUnique({
        where: { phone }
      })

      if (existing && existing.isActive) {
        return NextResponse.json({ error: 'Phone already in blacklist' }, { status: 409 })
      }

      if (existing && !existing.isActive) {
        // Re-activate if was removed
        await db.blacklist.update({
          where: { id: existing.id },
          data: { isActive: true, removedAt: null, removedBy: null }
        })
        return NextResponse.json({ success: true, message: 'Phone reactivated in blacklist' })
      }

      const blacklist = await db.blacklist.create({
        data: {
          phone: phone.trim(),
          reason: reason?.trim() || null,
          autoFlagged,
          returnCount: 0
        }
      })

      return NextResponse.json({ blacklist, created: true })
    } catch (error) {
      console.error('Add blacklist error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}

// DELETE /api/blacklist/[phone] - Remove from blacklist
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  return withAuditContext(async () => {
    try {
      const user = await getSession()
      if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

      if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 })
      }

      const { phone } = await params

      const blacklist = await db.blacklist.findUnique({
        where: { phone }
      })

      if (!blacklist) {
        return NextResponse.json({ error: 'Phone not found in blacklist' }, { status: 404 })
      }

      await db.blacklist.update({
        where: { id: blacklist.id },
        data: {
          isActive: false,
          removedAt: new Date(),
          removedBy: user.id
        }
      })

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Delete blacklist error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}
