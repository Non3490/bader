import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * GET /api/delivery/performance
 * Get delivery man performance metrics
 * ADMIN only
 */
export async function GET(request: NextRequest) {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const period = parseInt(searchParams.get('period') || '7') // days

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - period)
    startDate.setHours(0, 0, 0, 0)

    // 1. Get all delivery users (old system)
    const deliveryMen = await db.user.findMany({
      where: { role: 'DELIVERY', isActive: true },
      select: { id: true, name: true, phone: true, createdAt: true }
    })

    // 2. Also get all Driver records (new system)
    const drivers = await db.driver.findMany({
      where: { status: { in: ['AVAILABLE', 'ON_DELIVERY'] } },
      select: { id: true, name: true, phone: true, createdAt: true }
    })

    // Build a map to merge drivers by phone (avoid duplicates)
    const seenPhones = new Set<string>()
    const allDrivers: { id: string; name: string; phone?: string | null; source: 'user' | 'driver'; matchedUserId?: string }[] = []

    // Add old-system delivery men
    for (const dm of deliveryMen) {
      allDrivers.push({ id: dm.id, name: dm.name, phone: dm.phone, source: 'user' })
      if (dm.phone) seenPhones.add(dm.phone)
    }

    // Add new-system drivers (skip if phone already seen)
    for (const dr of drivers) {
      if (dr.phone && seenPhones.has(dr.phone)) {
        // Link to the user record
        const existing = allDrivers.find(d => d.phone === dr.phone)
        if (existing) existing.matchedUserId = dr.id
      } else {
        allDrivers.push({ id: dr.id, name: dr.name, phone: dr.phone, source: 'driver' })
        if (dr.phone) seenPhones.add(dr.phone)
      }
    }

    const performance = await Promise.all(
      allDrivers.map(async (dm) => {
        // Build OR conditions to find orders from both systems
        const orConditions: any[] = []

        if (dm.source === 'user' || dm.matchedUserId) {
          orConditions.push({ deliveryManId: dm.source === 'user' ? dm.id : dm.matchedUserId })
        }
        if (dm.source === 'driver') {
          orConditions.push({ assignedDriverId: dm.id })
        }

        // Also check Delivery records for the driver
        let deliveryRecordOrderIds: string[] = []
        if (dm.source === 'driver' || dm.matchedUserId) {
          const driverId = dm.source === 'driver' ? dm.id : dm.matchedUserId!
          const deliveryRecords = await db.delivery.findMany({
            where: {
              driverId,
              updatedAt: { gte: startDate }
            },
            select: { orderId: true, status: true, codCollected: true }
          })
          deliveryRecordOrderIds = deliveryRecords.map(d => d.orderId)
        }

        // Get orders from Order model
        const orders = await db.order.findMany({
          where: {
            OR: orConditions,
            updatedAt: { gte: startDate }
          }
        })

        // Also fetch orders from Delivery records that weren't found above
        const fetchedOrderIds = new Set(orders.map(o => o.id))
        const missedOrderIds = deliveryRecordOrderIds.filter(id => !fetchedOrderIds.has(id))
        let extraOrders: any[] = []
        if (missedOrderIds.length > 0) {
          extraOrders = await db.order.findMany({
            where: { id: { in: missedOrderIds } }
          })
        }

        const allOrders = [...orders, ...extraOrders]

        const delivered = allOrders.filter(o => o.status === 'DELIVERED').length
        const returned = allOrders.filter(o => o.status === 'RETURNED').length
        const cancelled = allOrders.filter(o => o.status === 'CANCELLED').length
        const postponed = allOrders.filter(o => o.status === 'POSTPONED').length
        const inProgress = allOrders.filter(o =>
          ['SHIPPED', 'OUT_FOR_DELIVERY', 'CONFIRMED'].includes(o.status)
        ).length

        // Calculate total cash collected
        const totalCashCollected = allOrders
          .filter(o => o.status === 'DELIVERED')
          .reduce((sum, o) => sum + o.codAmount, 0)

        // Calculate delivery rate
        const deliveredOrReturned = delivered + returned
        const deliveryRate = deliveredOrReturned > 0
          ? (delivered / deliveredOrReturned * 100).toFixed(1)
          : '0.0'

        // Calculate average deliveries per day
        const avgDeliveriesPerDay = period > 0
          ? (delivered / period).toFixed(1)
          : '0.0'

        return {
          id: dm.id,
          name: dm.name,
          delivered,
          returned,
          cancelled,
          postponed,
          inProgress,
          totalCashCollected,
          deliveryRate,
          avgDeliveriesPerDay
        }
      })
    )

    // Sort by delivered count descending
    performance.sort((a, b) => b.delivered - a.delivered)

    // Filter out drivers with zero activity in the period
    const activePerformance = performance.filter(d => d.delivered + d.returned + d.inProgress > 0)

    return NextResponse.json({
      performance: activePerformance,
      period,
      startDate
    })
  } catch (error) {
    console.error('Error fetching delivery performance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
