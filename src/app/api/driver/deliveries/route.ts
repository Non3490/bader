/**
 * Get Driver's Deliveries
 * GET /api/driver/deliveries?history=true
 * Returns list of active deliveries or history with stats
 *
 * Checks ALL assignment methods:
 * 1. Delivery model (new system) by driverId
 * 2. Order.assignedDriverId (direct driver assignment)
 * 3. Order.deliveryManId via phone match (legacy system)
 * 4. Order.deliveryManId via name match (fallback)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireDriverAuth } from '@/lib/driver-auth'
import { db } from '@/lib/db'

// All order statuses that mean "actively being delivered"
const ACTIVE_ORDER_STATUSES = ['SHIPPED', 'CONFIRMED', 'OUT_FOR_DELIVERY', 'POSTPONED']

function toLegacyDelivery(order: any, driverId: string) {
  return {
    id: `legacy-${order.id}`,
    orderId: order.id,
    driverId,
    status: 'ASSIGNED',
    assignedAt: order.shippedAt || order.createdAt,
    pickedUpAt: null,
    inTransitAt: null,
    deliveredAt: null,
    returnedAt: null,
    returnReason: null,
    returnNotes: null,
    codCollected: null,
    gpsPickupLat: null,
    gpsPickupLng: null,
    gpsDeliveryLat: null,
    gpsDeliveryLng: null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    order
  }
}

const ORDER_SELECT = {
  id: true,
  trackingNumber: true,
  recipientName: true,
  phone: true,
  address: true,
  city: true,
  codAmount: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  shippedAt: true
}

export async function GET(request: NextRequest) {
  try {
    const driver = await requireDriverAuth()
    const searchParams = request.nextUrl.searchParams
    const history = searchParams.get('history') === 'true'

    // ============ HISTORY / STATS ============
    if (history) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const deliveries: any[] = []
      const seenOrderIds = new Set<string>()

      // 1. Delivery model
      const newDeliveries = await db.delivery.findMany({
        where: {
          driverId: driver.id,
          status: { in: ['DELIVERED', 'RETURNED'] },
          OR: [
            { deliveredAt: { gte: today } },
            { returnedAt: { gte: today } }
          ]
        },
        include: {
          order: {
            select: {
              trackingNumber: true,
              recipientName: true,
              address: true,
              city: true,
              codAmount: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      })

      for (const d of newDeliveries) {
        seenOrderIds.add(d.orderId)
        deliveries.push(d)
      }

      // 2. Legacy orders by assignedDriverId
      const legacyByDriver = await db.order.findMany({
        where: {
          assignedDriverId: driver.id,
          status: { in: ['DELIVERED', 'RETURNED'] },
          id: { notIn: Array.from(seenOrderIds) },
          OR: [
            { deliveredAt: { gte: today } },
            { updatedAt: { gte: today } }
          ]
        },
        select: {
          id: true, trackingNumber: true, recipientName: true,
          address: true, city: true, codAmount: true,
          status: true, deliveredAt: true, returnedAt: true
        },
        orderBy: { updatedAt: 'desc' }
      })

      for (const order of legacyByDriver) {
        seenOrderIds.add(order.id)
        deliveries.push({
          id: `legacy-${order.id}`, status: order.status,
          deliveredAt: order.deliveredAt, returnedAt: order.returnedAt,
          codCollected: null, order
        })
      }

      // 3. Legacy orders by deliveryManId (phone match, any role)
      if (driver.phone) {
        const matchingUsers = await db.user.findMany({
          where: { phone: driver.phone },
          select: { id: true }
        })

        if (matchingUsers.length > 0) {
          const userIds = matchingUsers.map(u => u.id)
          const legacyByUser = await db.order.findMany({
            where: {
              deliveryManId: { in: userIds },
              status: { in: ['DELIVERED', 'RETURNED'] },
              id: { notIn: Array.from(seenOrderIds) },
              OR: [
                { deliveredAt: { gte: today } },
                { updatedAt: { gte: today } }
              ]
            },
            select: {
              id: true, trackingNumber: true, recipientName: true,
              address: true, city: true, codAmount: true,
              status: true, deliveredAt: true, returnedAt: true
            },
            orderBy: { updatedAt: 'desc' }
          })

          for (const order of legacyByUser) {
            if (seenOrderIds.has(order.id)) continue
            deliveries.push({
              id: `legacy-${order.id}`, status: order.status,
              deliveredAt: order.deliveredAt, returnedAt: order.returnedAt,
              codCollected: null, order
            })
          }
        }
      }

      // Calculate stats
      const totalDelivered = deliveries.filter(d => d.status === 'DELIVERED').length
      const totalReturned = deliveries.filter(d => d.status === 'RETURNED').length
      const totalCOD = deliveries.reduce((sum, d) => sum + (d.codCollected ?? d.order.codAmount), 0)

      const deliveredWithTimes = deliveries.filter(d =>
        d.status === 'DELIVERED' && d.pickedUpAt && d.deliveredAt
      )
      const averageTime = deliveredWithTimes.length > 0
        ? deliveredWithTimes.reduce((sum, d) => {
            return sum + (new Date(d.deliveredAt!).getTime() - new Date(d.pickedUpAt!).getTime())
          }, 0) / deliveredWithTimes.length / 1000 / 60
        : 0

      const successRate = (totalDelivered + totalReturned) > 0
        ? Math.round((totalDelivered / (totalDelivered + totalReturned)) * 100)
        : 0

      return NextResponse.json({
        deliveries,
        stats: {
          totalDelivered,
          totalReturned,
          totalCOD,
          averageTime: Math.round(averageTime),
          successRate
        }
      })
    }

    // ============ ACTIVE DELIVERIES ============
    const seenOrderIds = new Set<string>()
    const deliveries: any[] = []

    // 1. Delivery model (new system) — most reliable
    const newSystemDeliveries = await db.delivery.findMany({
      where: {
        driverId: driver.id,
        status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] }
      },
      include: {
        order: { select: ORDER_SELECT }
      },
      orderBy: { createdAt: 'asc' }
    })

    for (const d of newSystemDeliveries) {
      seenOrderIds.add(d.orderId)
      deliveries.push(d)
    }

    // 2. Orders assigned via assignedDriverId (direct Driver model assignment)
    const assignedOrders = await db.order.findMany({
      where: {
        assignedDriverId: driver.id,
        status: { in: ACTIVE_ORDER_STATUSES },
        id: { notIn: Array.from(seenOrderIds) }
      },
      select: ORDER_SELECT,
      orderBy: { createdAt: 'asc' }
    })

    for (const order of assignedOrders) {
      seenOrderIds.add(order.id)
      deliveries.push(toLegacyDelivery(order, driver.id))
    }

    // 3. Orders assigned via deliveryManId — match by phone (any role, not just DELIVERY)
    if (driver.phone) {
      const matchingUsers = await db.user.findMany({
        where: { phone: driver.phone },
        select: { id: true }
      })

      if (matchingUsers.length > 0) {
        const userIds = matchingUsers.map(u => u.id)
        const legacyOrders = await db.order.findMany({
          where: {
            deliveryManId: { in: userIds },
            status: { in: ACTIVE_ORDER_STATUSES },
            id: { notIn: Array.from(seenOrderIds) }
          },
          select: ORDER_SELECT,
          orderBy: { createdAt: 'asc' }
        })

        for (const order of legacyOrders) {
          seenOrderIds.add(order.id)
          deliveries.push(toLegacyDelivery(order, driver.id))
        }
      }
    }

    // Note: name-based fallback removed — it caused all drivers to see each other's orders

    return NextResponse.json({ deliveries })

  } catch (error: any) {
    if (error.message === 'DRIVER_NOT_AUTHENTICATED') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    console.error('Get deliveries error:', error)
    return NextResponse.json(
      { error: 'Failed to get deliveries' },
      { status: 500 }
    )
  }
}
