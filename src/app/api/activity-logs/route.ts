import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'))
    const skip = (page - 1) * limit
    const action = searchParams.get('action') || undefined
    const userId = searchParams.get('userId') || undefined
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const exportCsv = searchParams.get('export') === 'csv'

    // Build where clause
    const where: Record<string, unknown> = {}

    // Non-admins can only see their own logs
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      where.userId = user.id
    } else if (userId) {
      where.userId = userId
    }

    if (action) where.action = { contains: action }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: exportCsv ? 10000 : limit,
        skip: exportCsv ? 0 : skip,
      }),
      db.activityLog.count({ where })
    ])

    if (exportCsv) {
      const header = 'Timestamp,User,Email,Role,Action,Details\n'
      const rows = logs.map(l => {
        const ts = new Date(l.createdAt).toISOString()
        const name = `"${(l.user?.name ?? 'Unknown').replace(/"/g, '""')}"`
        const email = `"${(l.user?.email ?? '').replace(/"/g, '""')}"`
        const role = l.user?.role ?? l.role ?? ''
        const actionStr = `"${l.action.replace(/"/g, '""')}"`
        const details = `"${(l.details ?? '').replace(/"/g, '""')}"`
        return `${ts},${name},${email},${role},${actionStr},${details}`
      }).join('\n')
      const csv = header + rows
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="activity-logs-${Date.now()}.csv"`
        }
      })
    }

    return NextResponse.json({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error('Activity logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
