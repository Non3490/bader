import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminSession, checkPermission } from '@/lib/admin-auth'

// GET /api/admin/finance/withdrawals - List pending withdrawal requests
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const permissionCheck = checkPermission(session.role as any, 'reports:view_all')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING'

    const withdrawals = await db.withdrawalRequest.findMany({
      where: { status },
      include: {
        wallet: {
          select: {
            id: true,
            balance: true,
            seller: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return NextResponse.json({ withdrawals })
  } catch (error) {
    console.error('List withdrawals error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
