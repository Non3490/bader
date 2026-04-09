/**
 * Admin Driver Management API
 * GET /api/admin/drivers - List all drivers
 * POST /api/admin/drivers - Create new driver
 */

import { NextRequest, NextResponse } from 'next/server'
import { hashPin } from '@/lib/driver-auth'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

/**
 * GET - List all drivers
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAuth()

    if (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const drivers = await db.driver.findMany({
      where: {
        ...(status && { status }),
        ...(!includeInactive && { isActive: true })
      },
      include: {
        _count: {
          select: {
            deliveries: {
              where: {
                status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Remove PIN from response
    const sanitizedDrivers = drivers.map(({ pin, ...driver }) => ({
      ...driver,
      activeDeliveries: driver._count.deliveries
    }))

    return NextResponse.json({ drivers: sanitizedDrivers })

  } catch (error: any) {
    console.error('List drivers error:', error)
    return NextResponse.json(
      { error: 'Failed to list drivers' },
      { status: 500 }
    )
  }
}

/**
 * POST - Create new driver
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAuth()

    if (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, phone, pin, vehicleType, licensePlate, zone } = body

    // Validate required fields
    if (!name || !phone || !pin) {
      return NextResponse.json(
        { error: 'Name, phone, and PIN are required' },
        { status: 400 }
      )
    }

    // Validate PIN format (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be 4-6 digits' },
        { status: 400 }
      )
    }

    // Check if phone already exists
    const existingDriver = await db.driver.findUnique({
      where: { phone }
    })

    if (existingDriver) {
      return NextResponse.json(
        { error: 'A driver with this phone number already exists' },
        { status: 400 }
      )
    }

    // Hash the PIN
    const hashedPin = await hashPin(pin)

    // Create driver
    const driver = await db.driver.create({
      data: {
        name,
        phone,
        pin: hashedPin,
        vehicleType: vehicleType || null,
        licensePlate: licensePlate || null,
        zone: zone || null,
        status: 'OFFLINE',
        isActive: true
      }
    })

    // Remove PIN from response
    const { pin: _, ...driverData } = driver

    return NextResponse.json({
      success: true,
      driver: driverData
    }, { status: 201 })

  } catch (error: any) {
    console.error('Create driver error:', error)
    return NextResponse.json(
      { error: 'Failed to create driver' },
      { status: 500 }
    )
  }
}
