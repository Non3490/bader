import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'))
    const skip = (page - 1) * limit
    const action = searchParams.get('action') || undefined
    const targetType = searchParams.get('targetType') || undefined
    const adminId = searchParams.get('adminId') || undefined
    const exportCsv = searchParams.get('export') === 'true'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Record<string, unknown> = {}
    if (action) where.action = { contains: action }
    if (targetType) where.targetType = targetType
    if (adminId) where.adminId = adminId

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: exportCsv ? 10000 : limit,
        skip: exportCsv ? 0 : skip,
      }),
      db.auditLog.count({ where })
    ])

    if (exportCsv) {
      const header = 'Timestamp,Admin,Role,Action,Target Type,Target ID,Details\n'
      const rows = logs.map(l => {
        const ts = new Date(l.createdAt).toISOString()
        const name = `"${(l.userName ?? 'System').replace(/"/g, '""')}"`
        const role = l.userRole ?? 'SYSTEM'
        const action = `"${l.action.replace(/"/g, '""')}"`
        const targetType = `"${(l.targetType ?? '').replace(/"/g, '""')}"`
        const targetId = `"${(l.targetId ?? '').replace(/"/g, '""')}"`
        const details = `"${(l.details ?? '').replace(/"/g, '""')}"`
        return `${ts},${name},${role},${action},${targetType},${targetId},${details}`
      }).join('\n')
      const csv = header + rows
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${Date.now()}.csv"`
        }
      })
    }

    return NextResponse.json({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error('Audit logs GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
