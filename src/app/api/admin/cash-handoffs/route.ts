/**
 * Admin Cash Handoffs API
 * GET /api/admin/cash-handoffs - List all cash handoffs
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAuth()

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const driverId = searchParams.get('driverId')

    const where: any = {}
    if (status) where.status = status
    if (driverId) where.driverId = driverId

    const handoffs = await db.cashHandoff.findMany({
      where,
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      },
      orderBy: { shiftDate: 'desc' }
    })

    return NextResponse.json({ handoffs })

  } catch (error: any) {
    console.error('List cash handoffs error:', error)
    return NextResponse.json(
      { error: 'Failed to list cash handoffs' },
      { status: 500 }
    )
  }
}
