import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminSession, checkPermission } from '@/lib/admin-auth'

// GET /api/admin/admins/[id]/activity - Get audit logs for a specific admin
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

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')

    const auditLogs = await db.auditLog.findMany({
      where: {
        adminId: params.id
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        impersonatingAs: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    // Format the logs for easier consumption
    const formattedLogs = auditLogs.map(log => {
      let details = {}
      try {
        details = JSON.parse(log.details)
      } catch {
        // Keep as is if not valid JSON
      }

      return {
        id: log.id,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        details,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
        impersonatingAs: log.impersonatingAs
      }
    })

    return NextResponse.json({
      adminId: params.id,
      logs: formattedLogs,
      total: formattedLogs.length
    })
  } catch (error) {
    console.error('Get admin activity error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
