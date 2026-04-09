import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getDeliveryFeeConfig, upsertDeliveryFeeConfig } from '@/lib/finance-service'

// GET /api/finance/delivery-fees — Get delivery fee configs
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role === 'SELLER') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const deliveryManId = searchParams.get('deliveryManId')

    if (deliveryManId) {
      const config = await getDeliveryFeeConfig(deliveryManId)
      return NextResponse.json(config)
    }

    // Get all delivery men with their configs
    const deliveryMen = await db.user.findMany({
      where: { role: 'DELIVERY', isActive: true },
      include: {
        deliveryFeeConfig: true,
        orders: {
          where: {
            status: 'DELIVERED',
            deliveredAt: { gte: getDateFromPeriod('30d') }
          },
          select: { id: true }
        }
      }
    })

    // Calculate performance metrics for each delivery man
    const deliveryMenWithStats = await Promise.all(
      deliveryMen.map(async (dm) => {
        const totalDeliveries = dm.orders.length

        // Count on-time deliveries (within 24 hours of shipping)
        const onTimeDeliveries = await db.order.count({
          where: {
            deliveryManId: dm.id,
            status: 'DELIVERED',
            shippedAt: { not: null },
            deliveredAt: { not: null }
          }
        })

        const onTimeRate = totalDeliveries > 0 ? (onTimeDeliveries / totalDeliveries) * 100 : 0

        const config = dm.deliveryFeeConfig || {
          costPerDelivery: 0,
          bonusAmount: 0,
          penaltyAmount: 0
        }

        const totalFees = totalDeliveries * config.costPerDelivery
        const bonusAmount = Math.round(onTimeDeliveries * config.bonusAmount)
        const penaltyAmount = Math.round((totalDeliveries - onTimeDeliveries) * config.penaltyAmount)
        const netEarnings = totalFees + bonusAmount - penaltyAmount

        return {
          id: dm.id,
          name: dm.name,
          email: dm.email,
          totalDeliveries,
          onTimeRate: Math.round(onTimeRate * 10) / 10,
          feeConfig: config,
          totalFees,
          bonusAmount,
          penaltyAmount,
          netEarnings,
          status: onTimeRate >= 90 ? 'ACTIVE' : onTimeRate >= 75 ? 'ACTIVE' : 'ON_PROBATION'
        }
      })
    )

    // Calculate overall stats
    const overallStats = deliveryMenWithStats.reduce(
      (acc, dm) => ({
        totalDeliveries: acc.totalDeliveries + dm.totalDeliveries,
        avgOnTimeRate: acc.avgOnTimeRate + dm.onTimeRate,
        totalFeesPaid: acc.totalFeesPaid + dm.totalFees,
        totalBonusPaid: acc.totalBonusPaid + dm.bonusAmount,
        totalPenalties: acc.totalPenalties + dm.penaltyAmount
      }),
      { totalDeliveries: 0, avgOnTimeRate: 0, totalFeesPaid: 0, totalBonusPaid: 0, totalPenalties: 0 }
    )

    overallStats.avgOnTimeRate = deliveryMenWithStats.length > 0
      ? Math.round((overallStats.avgOnTimeRate / deliveryMenWithStats.length) * 10) / 10
      : 0

    return NextResponse.json({
      deliveryMen: deliveryMenWithStats,
      overallStats
    })
  } catch (error) {
    console.error('Delivery Fees GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/finance/delivery-fees — Update delivery fee config
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role === 'SELLER') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { deliveryManId, costPerDelivery, bonusAmount, penaltyAmount } = body

    if (!deliveryManId) {
      return NextResponse.json({ error: 'deliveryManId is required' }, { status: 400 })
    }

    const config = await upsertDeliveryFeeConfig(
      deliveryManId,
      parseFloat(costPerDelivery || 0),
      parseFloat(bonusAmount || 0),
      parseFloat(penaltyAmount || 0)
    )

    return NextResponse.json(config)
  } catch (error) {
    console.error('Delivery Fees POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getDateFromPeriod(period: string): Date {
  const now = new Date()
  switch (period) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}
