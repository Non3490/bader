import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireSuperAdmin } from '@/lib/admin-auth'
import { startImpersonation } from '@/lib/impersonation-service'

export async function POST(request: NextRequest) {
  try {
    // Verify admin is authenticated and is Super Admin
    const admin = await requireSuperAdmin()

    const body = await request.json()
    const { targetUserId } = body

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Target user ID is required' },
        { status: 400 }
      )
    }

    // Start impersonation
    const result = await startImpersonation(admin.adminId, targetUserId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      expiresAt: result.expiresAt
    })
  } catch (error) {
    console.error('Start impersonation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
