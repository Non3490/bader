import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET all webhook configs
export async function GET() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const integrations = await db.integration.findMany({
      where: user.role === 'ADMIN' ? {} : { sellerId: user.id },
      orderBy: { createdAt: 'asc' }
    })

    // Get recent webhook activity
    const recentActivity = await db.webhookActivity.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' }
    })

    // Format response with webhook URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://egabon.vercel.app'
    const platforms = integrations.map(int => ({
      id: int.id,
      platform: int.platform,
      isActive: int.isActive,
      lastHit: int.lastHit,
      webhookUrl: `${baseUrl}/api/webhooks/${int.platform.toLowerCase()}`,
      configured: !!int.secret
    }))

    return NextResponse.json({
      platforms,
      recentActivity: recentActivity.map(a => ({
        id: a.id,
        platform: a.platform,
        status: a.status,
        eventType: a.eventType,
        trackingNumber: a.trackingNumber,
        reason: a.reason,
        createdAt: a.createdAt
      }))
    })
  } catch (error) {
    console.error('[Settings:Webhooks] GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST to create/update webhook config
export async function POST(req: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { platform, secret, sellerId } = body

    if (!platform || !secret) {
      return NextResponse.json({ error: 'Missing platform or secret' }, { status: 400 })
    }

    const validPlatforms = ['SHOPIFY', 'YOUCAN', 'DROPIFY', 'LIGHTFUNNELS']
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }

    const targetSellerId = (user.role === 'ADMIN' && sellerId) ? sellerId : user.id

    const integration = await db.integration.upsert({
      where: {
        sellerId_platform: { sellerId: targetSellerId, platform }
      },
      create: {
        sellerId: targetSellerId,
        platform,
        secret,
        isActive: true
      },
      update: {
        secret,
        isActive: true
      },
      include: {
        seller: { select: { name: true, email: true } }
      }
    })

    return NextResponse.json({
      integration: {
        id: integration.id,
        platform: integration.platform,
        isActive: integration.isActive,
        lastHit: integration.lastHit
      }
    })
  } catch (error) {
    console.error('[Settings:Webhooks] POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
