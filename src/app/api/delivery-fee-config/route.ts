import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

// POST /api/delivery-fee-config - Create or update delivery fee config
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { deliveryManId, costPerDelivery, bonusAmount, penaltyAmount } = body

    if (!deliveryManId) {
      return NextResponse.json({ error: 'deliveryManId is required' }, { status: 400 })
    }

    const deliveryMan = await db.user.findUnique({
      where: { id: deliveryManId, role: 'DELIVERY' }
    })

    if (!deliveryMan) {
      return NextResponse.json({ error: 'Delivery man not found' }, { status: 404 })
    }

    // Upsert fee config
    const feeConfig = await db.deliveryFeeConfig.upsert({
      where: { deliveryManId },
      update: {
        costPerDelivery: costPerDelivery || 0,
        bonusAmount: bonusAmount || 0,
        penaltyAmount: penaltyAmount || 0
      },
      create: {
        deliveryManId,
        costPerDelivery: costPerDelivery || 0,
        bonusAmount: bonusAmount || 0,
        penaltyAmount: penaltyAmount || 0
      }
    })

    await logActivity(
      user.id,
      user.role,
      'DELIVERY_FEE_CONFIG_UPDATED',
      `Fee config updated for ${deliveryMan.name}: ${costPerDelivery} XAF/delivery`
    )

    return NextResponse.json({ feeConfig })
  } catch (error) {
    console.error('Delivery fee config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/delivery-fee-config - Get fee config for a delivery man
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const searchParams = request.nextUrl.searchParams
    const deliveryManId = searchParams.get('deliveryManId')

    if (!deliveryManId) {
      return NextResponse.json({ error: 'deliveryManId is required' }, { status: 400 })
    }

    // Admin can see any config, delivery men can only see their own
    if ((user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') && user.id !== deliveryManId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const feeConfig = await db.deliveryFeeConfig.findUnique({
      where: { deliveryManId }
    })

    return NextResponse.json({ feeConfig })
  } catch (error) {
    console.error('Get delivery fee config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
