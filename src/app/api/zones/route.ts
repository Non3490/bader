import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

// GET /api/zones - List all zones
export async function GET(request: Request) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const zones = await db.zone.findMany({
      include: {
        deliveryMen: {
          select: { id: true, name: true }
        },
        _count: {
          select: { orders: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ zones })
  } catch (error) {
    console.error('Get zones error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/zones - Create new zone
export async function POST(request: Request) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { name, city, description, deliveryManIds } = body

    if (!name?.trim() || !city?.trim()) {
      return NextResponse.json({ error: 'Name and city are required' }, { status: 400 })
    }

    const zone = await db.zone.create({
      data: {
        name: name.trim(),
        city: city.trim(),
        description: description?.trim() || null,
        deliveryMen: deliveryManIds?.length > 0
          ? {
              connect: deliveryManIds.map((id: string) => ({ id }))
            }
          : undefined
      },
      include: {
        deliveryMen: { select: { id: true, name: true } },
        _count: { select: { orders: true } }
      }
    })

    await logActivity(user.id, user.role, 'ZONE_CREATED', `Zone "${name}" created in ${city}`)

    return NextResponse.json({ zone })
  } catch (error) {
    console.error('Create zone error:', error)
    return NextResponse.json({ error: 'Failed to create zone' }, { status: 500 })
  }
}

// PUT /api/zones - Update zone
export async function PUT(request: Request) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, city, description, deliveryManIds } = body

    if (!id) {
      return NextResponse.json({ error: 'Zone ID is required' }, { status: 400 })
    }

    if (!name?.trim() || !city?.trim()) {
      return NextResponse.json({ error: 'Name and city are required' }, { status: 400 })
    }

    // Update zone and reassign delivery men
    const zone = await db.zone.update({
      where: { id },
      data: {
        name: name.trim(),
        city: city.trim(),
        description: description?.trim() || null,
        deliveryMen: deliveryManIds
          ? {
              set: deliveryManIds.map((dmId: string) => ({ id: dmId }))
            }
          : {
              set: []
            }
      },
      include: {
        deliveryMen: { select: { id: true, name: true } },
        _count: { select: { orders: true } }
      }
    })

    await logActivity(user.id, user.role, 'ZONE_UPDATED', `Zone "${name}" updated`)

    return NextResponse.json({ zone })
  } catch (error) {
    console.error('Update zone error:', error)
    return NextResponse.json({ error: 'Failed to update zone' }, { status: 500 })
  }
}
