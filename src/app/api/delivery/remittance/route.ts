import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * GET /api/delivery/remittance
 * Get delivery men cash summary for remittance
 * ADMIN only
 */
export async function GET(request: NextRequest) {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    // Get all active delivery men
    const deliveryMen = await db.user.findMany({
      where: { role: 'DELIVERY', isActive: true },
      select: { id: true, name: true }
    })

    // Today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get remittance data for each delivery man
    const remittanceData = await Promise.all(
      deliveryMen.map(async (dm) => {
        // Get today's delivered orders for this delivery man
        const orders = await db.order.findMany({
          where: {
            deliveryManId: dm.id,
            status: 'DELIVERED',
            updatedAt: { gte: today, lt: tomorrow }
          }
        })

        const totalCash = orders.reduce((sum, o) => sum + o.codAmount, 0)
        const ordersToday = orders.length

        // Check if already locked (invoice exists for today)
        const existingInvoice = await db.invoice.findFirst({
          where: {
            deliveryManId: dm.id,
            cycleType: 'DELIVERY',
            isLocked: true,
            createdAt: { gte: today, lt: tomorrow }
          }
        })

        return {
          deliveryMan: dm,
          ordersToday,
          deliveredCount: ordersToday,
          totalCashCollected: totalCash,
          isLocked: !!existingInvoice,
          invoiceId: existingInvoice?.id || null,
          invoiceRef: existingInvoice?.ref || null,
          lockedAt: existingInvoice?.createdAt || null
        }
      })
    )

    return NextResponse.json({ data: remittanceData })
  } catch (error) {
    console.error('Error fetching remittance data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
