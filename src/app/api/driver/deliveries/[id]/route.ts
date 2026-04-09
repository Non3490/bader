/**
 * Get Single Delivery Detail
 * GET /api/driver/deliveries/[id]
 */

import { NextResponse } from 'next/server'
import { requireDriverAuth } from '@/lib/driver-auth'
import { db } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const driver = await requireDriverAuth()
    let deliveryId = id

    // Handle legacy IDs (orders assigned via old system without Delivery records)
    let isLegacy = false
    let orderId: string | undefined
    if (deliveryId.startsWith('legacy-')) {
      isLegacy = true
      orderId = deliveryId.replace('legacy-', '')
    }

    let delivery

    if (isLegacy && orderId) {
      // Look up by orderId instead
      delivery = await db.delivery.findUnique({
        where: { orderId },
        include: {
          order: {
            select: {
              id: true,
              trackingNumber: true,
              recipientName: true,
              phone: true,
              address: true,
              city: true,
              note: true,
              codAmount: true,
              status: true,
              items: {
                select: {
                  quantity: true,
                  product: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      })

      // If still no delivery record, look up the order directly
      if (!delivery) {
        const order = await db.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            trackingNumber: true,
            recipientName: true,
            phone: true,
            address: true,
            city: true,
            note: true,
            codAmount: true,
            status: true,
            shippedAt: true,
            createdAt: true,
            items: {
              select: {
                quantity: true,
                product: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        })

        if (order) {
          // Verify the order belongs to this driver
          const matchingUsers = driver.phone
            ? await db.user.findMany({ where: { phone: driver.phone.replace(/\s/g, '') }, select: { id: true } })
            : []
          const userIds = matchingUsers.map(u => u.id)

          const isOwner =
            order.assignedDriverId === driver.id ||
            (order.deliveryManId && userIds.includes(order.deliveryManId))

          if (!isOwner) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 })
          }

          // Create a synthetic delivery object for the response
          delivery = {
            id: deliveryId,
            orderId: order.id,
            driverId: driver.id,
            status: 'ASSIGNED',
            assignedAt: order.shippedAt || order.createdAt,
            pickedUpAt: null,
            inTransitAt: null,
            deliveredAt: null,
            returnedAt: null,
            returnReason: null,
            returnNotes: null,
            codCollected: null,
            order
          }
        }
      }
    } else {
      delivery = await db.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          order: {
            select: {
              id: true,
              trackingNumber: true,
              recipientName: true,
              phone: true,
              address: true,
              city: true,
              note: true,
              codAmount: true,
              status: true,
              items: {
                select: {
                  quantity: true,
                  product: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      })
    }

    if (!delivery) {
      return NextResponse.json(
        { error: 'Delivery not found' },
        { status: 404 }
      )
    }

    // Verify this delivery belongs to the authenticated driver
    if (delivery.driverId !== driver.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({ delivery })

  } catch (error: any) {
    if (error.message === 'DRIVER_NOT_AUTHENTICATED') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    console.error('Get delivery detail error:', error)
    return NextResponse.json(
      { error: 'Failed to get delivery' },
      { status: 500 }
    )
  }
}
