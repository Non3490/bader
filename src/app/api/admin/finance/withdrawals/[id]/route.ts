import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminSession, checkPermission } from '@/lib/admin-auth'
import { logAction, AUDIT_ACTIONS } from '@/lib/audit-logger'

interface WithdrawalActionBody {
  action: 'approve' | 'reject'
  note?: string
}

// POST /api/admin/finance/withdrawals/[id] - Approve or reject a withdrawal
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const permissionCheck = checkPermission(session.role as any, 'reports:view_all')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body: WithdrawalActionBody = await request.json()
    const { action, note } = body

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    // Get withdrawal request with seller info
    const withdrawal = await db.withdrawalRequest.findUnique({
      where: { id: params.id },
      include: {
        wallet: {
          include: {
            seller: true
          }
        }
      }
    })

    if (!withdrawal) {
      return NextResponse.json(
        { error: 'Withdrawal request not found' },
        { status: 404 }
      )
    }

    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Withdrawal request already processed' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      // Update withdrawal status to APPROVED
      await db.withdrawalRequest.update({
        where: { id: params.id },
        data: {
          status: 'APPROVED',
          processedAt: new Date(),
          processedBy: session.adminId,
          note
        }
      })

      // Log the action
      await logAction(
        session.adminId,
        session.name,
        session.role as any,
        {
          action: AUDIT_ACTIONS.SETTINGS_UPDATED, // Reusing for financial actions
          targetType: 'WithdrawalRequest',
          targetId: params.id,
          details: {
            before: { status: 'PENDING' },
            after: { status: 'APPROVED', amount: withdrawal.amount }
          }
        }
      )
    } else {
      // Reject - just update status, no wallet debit needed
      await db.withdrawalRequest.update({
        where: { id: params.id },
        data: {
          status: 'REJECTED',
          processedAt: new Date(),
          processedBy: session.adminId,
          note
        }
      })

      // Log the action
      await logAction(
        session.adminId,
        session.name,
        session.role as any,
        {
          action: AUDIT_ACTIONS.SETTINGS_UPDATED,
          targetType: 'WithdrawalRequest',
          targetId: params.id,
          details: {
            before: { status: 'PENDING' },
            after: { status: 'REJECTED', reason: note || 'No reason provided' }
          }
        }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Withdrawal action error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
