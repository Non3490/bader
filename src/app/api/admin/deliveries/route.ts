/**
 * Admin Deliveries API
 * GET /api/admin/delivers - List all deliveries with filters
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = request.nextUrl
    const driverId = searchParams.get('driverId')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const exportFormat = searchParams.get('export') // 'csv'

    // Build where clause
    const where: any = {}

    if (driverId) where.driverId = driverId
    if (status) where.status = status
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    // Get total count
    const total = await db.delivery.count({ where })

    // Get deliveries with pagination
    const deliveries = await db.delivery.findMany({
      where,
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        order: {
          select: {
            trackingNumber: true,
            recipientName: true,
            phone: true,
            address: true,
            city: true,
            codAmount: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    // Export to CSV if requested
    if (exportFormat === 'csv') {
      const csv = generateDeliveriesCSV(deliveries)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="deliveries-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    return NextResponse.json({
      deliveries,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error: any) {
    console.error('List deliveries error:', error)
    return NextResponse.json(
      { error: 'Failed to list deliveries' },
      { status: 500 }
    )
  }
}

function generateDeliveriesCSV(deliveries: any[]): string {
  const headers = [
    'Delivery ID',
    'Tracking Number',
    'Driver Name',
    'Status',
    'Customer',
    'Address',
    'City',
    'COD Amount',
    'Assigned At',
    'Delivered At',
    'Return Reason'
  ]

  const rows = deliveries.map(d => [
    d.id,
    d.order.trackingNumber,
    d.driver.name,
    d.status,
    d.order.recipientName,
    `"${d.order.address}"`, // Quote address in case of commas
    d.order.city,
    d.order.codAmount.toString(),
    d.assignedAt.toISOString(),
    d.deliveredAt?.toISOString() || '',
    d.returnReason || ''
  ])

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
}
