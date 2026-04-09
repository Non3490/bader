import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity } from '@/lib/activity-logger'

// GET all sourcing requests
export async function GET(req: Request) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    
    // Admins see all requests; sellers see only their own
    const query: any = {}
    if (user.role === 'SELLER') {
      query.sellerId = user.id
    }
    
    if (status) {
      query.status = status
    }

    const requests = await db.sourcingRequest.findMany({
      where: query,
      include: {
        seller: {
          select: { name: true, phone: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Fetch Sourcing Requests Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST create a new sourcing request
export async function POST(req: Request) {
  try {
    const user = await getSession()
    if (!user || user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized. Only sellers can create requests.' }, { status: 401 })
    }

    const body = await req.json()
    const { productName, description, quantity, country, shippingMethod, images = [], type = 'INBOUND' } = body

    if (!productName || !quantity || !country || !shippingMethod) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const newRequest = await db.sourcingRequest.create({
      data: {
        sellerId: user.id,
        productName,
        description,
        quantity: parseInt(quantity, 10),
        country,
        shippingMethod,
        images,
        type,
        status: 'SUBMITTED'
      }
    })

    // Log activity
    await logActivity({
      userId: user.id,
      userRole: user.role,
      action: 'SOURCING_CREATED',
      targetId: newRequest.id,
      description: `Created sourcing request for ${quantity}x ${productName}`,
    })

    return NextResponse.json({ request: newRequest }, { status: 201 })
  } catch (error) {
    console.error('Create Sourcing Request Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
