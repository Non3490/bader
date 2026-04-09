import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, checkPermission } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ allowed: false, error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { permission } = body

    if (!permission) {
      return NextResponse.json({ error: 'Permission is required' }, { status: 400 })
    }

    const result = checkPermission(session.role as any, permission)

    return NextResponse.json({ allowed: result.allowed })
  } catch (error) {
    console.error('Check permission error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
