import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, clearAdminSession } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json(
        { error: 'No active session' },
        { status: 401 }
      )
    }

    // Clear the admin session cookie
    const response = NextResponse.json({ success: true })

    response.cookies.delete('adminSession')

    return response
  } catch (error) {
    console.error('Admin logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
