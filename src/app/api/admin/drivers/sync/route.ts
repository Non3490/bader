/**
 * POST /api/admin/drivers/sync
 * Repair: ensure every User with role=DELIVERY has a matching Driver entity
 * and that SHIPPED/POSTPONED orders have Delivery records for their drivers.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAdminSession } from '@/lib/admin-auth'
import { hashPin } from '@/lib/driver-auth'
import { db } from '@/lib/db'

export async function POST(_req: NextRequest) {
  try {
    const user = await getSession()
    const adminSession = await getAdminSession()
    const isAuthorized =
      (user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) ||
      (adminSession && (adminSession.role === 'ADMIN' || adminSession.role === 'SUPER_ADMIN' || adminSession.role === 'MANAGER'))

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const deliveryUsers = await db.user.findMany({
      where: { role: 'DELIVERY', isActive: true },
      select: { id: true, name: true, phone: true }
    })

    const created: string[] = []
    const linked: number[] = []

    for (const du of deliveryUsers) {
      if (!du.phone) continue

      let driver = await db.driver.findUnique({ where: { phone: du.phone } })

      // Create Driver entity if missing
      if (!driver) {
        const defaultPin = du.phone.replace(/\D/g, '').slice(-4) || '1234'
        const hashedPin = await hashPin(defaultPin)
        driver = await db.driver.create({
          data: {
            name: du.name ?? 'Agent',
            phone: du.phone,
            pin: hashedPin,
            status: 'OFFLINE',
            isActive: true
          }
        })
        created.push(`${du.name} (${du.phone}) — PIN: ${defaultPin}`)
      }

      // Create missing Delivery records for active orders assigned to this User
      const orders = await db.order.findMany({
        where: {
          deliveryManId: du.id,
          status: { in: ['SHIPPED', 'POSTPONED'] }
        },
        select: { id: true }
      })

      if (orders.length > 0) {
        const orderIds = orders.map(o => o.id)
        const existing = await db.delivery.findMany({
          where: { orderId: { in: orderIds } },
          select: { orderId: true }
        })
        const existingSet = new Set(existing.map(d => d.orderId))
        const missing = orderIds.filter(id => !existingSet.has(id))

        if (missing.length > 0) {
          await db.delivery.createMany({
            data: missing.map(orderId => ({
              orderId,
              driverId: driver!.id,
              status: 'ASSIGNED',
              assignedAt: new Date()
            }))
          })
          await db.order.updateMany({
            where: { id: { in: missing } },
            data: { assignedDriverId: driver!.id }
          })
          linked.push(...missing)
        }
      }
    }

    return NextResponse.json({
      success: true,
      driversCreated: created,
      ordersLinked: linked.length,
      message: created.length === 0 && linked.length === 0
        ? 'All drivers already linked — nothing to do.'
        : `Created ${created.length} driver account(s), linked ${linked.length} order(s).`
    })
  } catch (error) {
    console.error('Driver sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
