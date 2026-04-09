import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/invoices/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { seller: { select: { id: true, name: true, email: true } } }
    })

    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && invoice.sellerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('Invoice GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/invoices/[id] - Admin updates status or lock
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, isLocked } = body

    const invoice = await db.invoice.findUnique({ where: { id } })
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (invoice.isLocked && !body.force) {
      return NextResponse.json({ error: 'Invoice is locked' }, { status: 409 })
    }

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (isLocked !== undefined) updateData.isLocked = isLocked

    const updated = await db.invoice.update({
      where: { id },
      data: updateData,
      include: { seller: { select: { id: true, name: true } } }
    })

    return NextResponse.json({ invoice: updated })
  } catch (error) {
    console.error('Invoice PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
