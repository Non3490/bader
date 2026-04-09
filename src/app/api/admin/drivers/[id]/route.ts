/**
 * Admin Single Driver Management API
 * GET /api/admin/drivers/[id] - Get driver details
 * PUT /api/admin/drivers/[id] - Update driver
 * DELETE /api/admin/drivers/[id] - Deactivate driver
 */

import { NextRequest, NextResponse } from 'next/server'
import { hashPin } from '@/lib/driver-auth'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

/**
 * GET - Get driver details
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const driverId = params.id

    const driver = await db.driver.findUnique({
      where: { id: driverId },
      include: {
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            order: {
              select: {
                trackingNumber: true,
                recipientName: true,
                codAmount: true,
                status: true
              }
            }
          }
        },
        cashHandoffs: {
          orderBy: { shiftDate: 'desc' },
          take: 5
        }
      }
    })

    if (!driver) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      )
    }

    // Remove PIN
    const { pin, ...driverData } = driver

    return NextResponse.json({ driver: driverData })

  } catch (error: any) {
    console.error('Get driver error:', error)
    return NextResponse.json(
      { error: 'Failed to get driver' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update driver
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const driverId = params.id
    const body = await request.json()
    const { name, phone, pin, vehicleType, licensePlate, zone, status, isActive } = body

    // Check if driver exists
    const existingDriver = await db.driver.findUnique({
      where: { id: driverId }
    })

    if (!existingDriver) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: any = {}

    if (name) updateData.name = name
    if (phone) updateData.phone = phone
    if (vehicleType !== undefined) updateData.vehicleType = vehicleType || null
    if (licensePlate !== undefined) updateData.licensePlate = licensePlate || null
    if (zone !== undefined) updateData.zone = zone || null
    if (status) updateData.status = status
    if (isActive !== undefined) updateData.isActive = isActive

    // Hash new PIN if provided
    if (pin) {
      if (!/^\d{4,6}$/.test(pin)) {
        return NextResponse.json(
          { error: 'PIN must be 4-6 digits' },
          { status: 400 }
        )
      }
      updateData.pin = await hashPin(pin)
    }

    // Update driver
    const driver = await db.driver.update({
      where: { id: driverId },
      data: updateData
    })

    // Remove PIN from response
    const { pin: _, ...driverData } = driver

    return NextResponse.json({ driver: driverData })

  } catch (error: any) {
    console.error('Update driver error:', error)
    return NextResponse.json(
      { error: 'Failed to update driver' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Deactivate driver (soft delete)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const driverId = params.id

    // Soft delete - set isActive to false
    await db.driver.update({
      where: { id: driverId },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Delete driver error:', error)
    return NextResponse.json(
      { error: 'Failed to delete driver' },
      { status: 500 }
    )
  }
}
