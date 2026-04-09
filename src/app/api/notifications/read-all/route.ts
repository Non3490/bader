import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PATCH() {
  try {
    const user = await getSession()
    if (!user || user.role !== 'CALL_CENTER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await db.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mark all notifications read error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
