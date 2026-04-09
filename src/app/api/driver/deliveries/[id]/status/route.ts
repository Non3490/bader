/**
 * Update Delivery Status
 * PUT /api/driver/deliveries/[id]/status
 * Body: { status: 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'POSTPONED', gpsLat?, gpsLng?, codCollected?, notes? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireDriverAuth } from '@/lib/driver-auth'
import { db } from '@/lib/db'
import { sendNotification } from '@/lib/notifications'

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  'ASSIGNED': ['PICKED_UP'],
  'PICKED_UP': ['IN_TRANSIT'],
  'IN_TRANSIT': ['DELIVERED', 'POSTPONED']
}

// Timestamp fields to update based on status
const TIMESTAMP_FIELDS: Record<string, string> = {
  'PICKED_UP': 'pickedUpAt',
  'IN_TRANSIT': 'inTransitAt',
  'DELIVERED': 'deliveredAt'
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const driver = await requireDriverAuth()
    let deliveryId = id
    const body = await request.json()
    const { status, gpsLat, gpsLng, codCollected, notes } = body

    // Handle legacy IDs (orders assigned via old system without Delivery records)
    if (deliveryId.startsWith('legacy-')) {
      const orderId = deliveryId.replace('legacy-', '')

      // Try to find existing delivery record by orderId
      let delivery = await db.delivery.findUnique({
        where: { orderId },
        include: {
          order: {
            include: {
              seller: {
                select: {
                  id: true,
                  tenantSettings: {
                    select: {
                      smsEnabled: true
                    }
                  }
                }
              }
            }
          },
          driver: {
            select: {
              name: true,
              phone: true
            }
          }
        }
      })

      if (!delivery) {
        // Create a proper Delivery record for this legacy order
        delivery = await db.delivery.create({
          data: {
            orderId,
            driverId: driver.id,
            status: 'ASSIGNED',
            assignedAt: new Date()
          },
          include: {
            order: {
              include: {
                seller: {
                  select: {
                    id: true,
                    tenantSettings: {
                      select: {
                        smsEnabled: true
                      }
                    }
                  }
                }
              }
            },
            driver: {
              select: {
                name: true,
                phone: true
              }
            }
          }
        })

        await db.order.update({
          where: { id: orderId },
          data: { assignedDriverId: driver.id }
        })
      }

      // Verify ownership
      if (delivery.driverId !== driver.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      // Now process the status update with the real delivery ID
      return processStatusUpdate(driver, delivery.id, status, gpsLat, gpsLng, codCollected, notes)
    }

    // Get current delivery
    const delivery = await db.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        order: {
          include: {
            seller: {
              select: {
                id: true,
                tenantSettings: {
                  select: {
                    smsEnabled: true
                  }
                }
              }
            }
          }
        },
        driver: {
          select: {
            name: true,
            phone: true
          }
        }
      }
    })

    if (!delivery) {
      return NextResponse.json(
        { error: 'Delivery not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (delivery.driverId !== driver.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return processStatusUpdate(driver, deliveryId, status, gpsLat, gpsLng, codCollected, notes)

  } catch (error: any) {
    if (error.message === 'DRIVER_NOT_AUTHENTICATED') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    console.error('Update delivery status error:', error)
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    )
  }
}

async function processStatusUpdate(
  driver: any,
  deliveryId: string,
  status: string,
  gpsLat: number | undefined,
  gpsLng: number | undefined,
  codCollected: number | undefined,
  notes?: string
) {
  // Get current delivery
  const delivery = await db.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      order: {
        include: {
          seller: {
            select: {
              id: true,
              tenantSettings: {
                select: {
                  smsEnabled: true
                }
              }
            }
          }
        }
      },
      driver: {
        select: {
          name: true,
          phone: true
        }
      }
    }
  })

  if (!delivery) {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
  }

  // Validate status transition
  const allowedTransitions = STATUS_TRANSITIONS[delivery.status] || []
  if (!allowedTransitions.includes(status)) {
    return NextResponse.json(
      {
        error: `Invalid status transition. Current: ${delivery.status}, Allowed: [${allowedTransitions.join(', ')}]`
      },
      { status: 400 }
    )
  }

  // Build update data
  const updateData: any = {
    status,
    updatedAt: new Date()
  }

  // Set timestamp based on status
  const timestampField = TIMESTAMP_FIELDS[status]
  if (timestampField) {
    updateData[timestampField] = new Date()
  }

  // Update GPS coordinates if provided
  if (gpsLat !== undefined && gpsLng !== undefined) {
    if (status === 'PICKED_UP') {
      updateData.gpsPickupLat = gpsLat
      updateData.gpsPickupLng = gpsLng
    } else if (status === 'DELIVERED') {
      updateData.gpsDeliveryLat = gpsLat
      updateData.gpsDeliveryLng = gpsLng
    }
  }

  // Update COD collected amount if provided
  if (codCollected !== undefined) {
    updateData.codCollected = codCollected
  }

  // Update delivery
  const updatedDelivery = await db.delivery.update({
    where: { id: deliveryId },
    data: updateData,
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

  // Sync order status based on delivery outcome
  if (status === 'DELIVERED') {
    await db.order.update({
      where: { id: delivery.orderId },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date()
      }
    })
  } else if (status === 'POSTPONED') {
    await db.order.update({
      where: { id: delivery.orderId },
      data: {
        status: 'POSTPONED',
        ...(notes ? { note: notes } : {})
      }
    })
  }

  // Send customer notification
  await sendDeliveryNotification(delivery.orderId, status, delivery.order, delivery.driver)

  return NextResponse.json({ delivery: updatedDelivery })
}

/**
 * Send notification for delivery events
 * Integrates with CORE 01 notification service
 */
async function sendDeliveryNotification(orderId: string, event: string, order: any, driver: any) {
  try {
    // Check if SMS is enabled for this seller
    const smsEnabled = order.seller?.tenantSettings?.smsEnabled ?? false

    if (!smsEnabled) {
      console.log('[NOTIFICATION] SMS not enabled for seller, skipping notification')
      return
    }

    // Build notification data
    const notificationData = {
      order: {
        ...order,
        driverName: driver.name,
        driverPhone: driver.phone
      }
    }

    // Map delivery status to notification type
    const notificationTypeMap: Record<string, string> = {
      'PICKED_UP': 'ORDER_SHIPPED',
      'IN_TRANSIT': 'ORDER_SHIPPED',
      'DELIVERED': 'ORDER_DELIVERED'
    }

    const notificationType = notificationTypeMap[event]

    if (!notificationType) {
      console.log('[NOTIFICATION] No notification type mapped for event:', event)
      return
    }

    // Call the notification service
    await sendNotification(notificationData.order, notificationType, 'SMS')

    console.log(`[NOTIFICATION] Sent ${notificationType} notification for order ${order.trackingNumber}`)
  } catch (error) {
    console.error('[NOTIFICATION] Error sending delivery notification:', error)
    // Don't fail the request if notification fails
  }
}
