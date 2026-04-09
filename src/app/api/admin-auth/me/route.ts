import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json(
        { error: 'No active session' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      admin: {
        id: session.adminId,
        email: session.email,
        name: session.name,
        role: session.role,
        impersonating: session.impersonatingId ? {
          id: session.impersonatingId,
          name: session.impersonatingName,
          role: session.impersonatingRole
        } : null
      }
    })
  } catch (error) {
    console.error('Get admin session error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
