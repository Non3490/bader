/**
 * Update Cash Handoff Status
 * PUT /api/admin/cash-handoffs/[id]
 * Body: { status: 'RECEIVED' | 'DISCREPANCY', adminNotes?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAuth()
    const handoffId = params.id
    const body = await request.json()
    const { status, adminNotes } = body

    // Validate status
    const validStatuses = ['RECEIVED', 'DISCREPANCY']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status', validStatuses },
        { status: 400 }
      )
    }

    // Update cash handoff
    const handoff = await db.cashHandoff.update({
      where: { id: handoffId },
      data: {
        status,
        adminNotes: adminNotes || null,
        receivedBy: admin.id,
        receivedAt: new Date()
      },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      }
    })

    return NextResponse.json({ handoff })

  } catch (error: any) {
    console.error('Update cash handoff error:', error)
    return NextResponse.json(
      { error: 'Failed to update cash handoff' },
      { status: 500 }
    )
  }
}
