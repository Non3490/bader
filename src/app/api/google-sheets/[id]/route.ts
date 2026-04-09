import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * DELETE /api/google-sheets/[id] - Remove Google Sheets integration
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const sheet = await db.googleSheet.findUnique({ where: { id } })
    if (!sheet) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && sheet.sellerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.googleSheet.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Google Sheets DELETE error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
