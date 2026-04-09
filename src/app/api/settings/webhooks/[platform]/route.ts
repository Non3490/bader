import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// PATCH to update a webhook secret
export async function PATCH(
  req: NextRequest,
  { params }: { params: { platform: string } }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { secret, isActive, sellerId } = body

    const validPlatforms = ['shopify', 'youcan', 'dropify', 'lightfunnels']
    const platform = params.platform.toLowerCase()

    if (!validPlatforms.includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }

    const targetSellerId = ((user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && sellerId) ? sellerId : user.id

    const integration = await db.integration.upsert({
      where: {
        sellerId_platform: { sellerId: targetSellerId, platform: platform.toUpperCase() }
      },
      create: {
        sellerId: targetSellerId,
        platform: platform.toUpperCase(),
        secret: secret || '',
        isActive: isActive !== undefined ? isActive : true
      },
      update: {
        ...(secret !== undefined && { secret }),
        ...(isActive !== undefined && { isActive })
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
    console.error('[Settings:Webhooks] PATCH error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE to remove a webhook config
export async function DELETE(
  req: NextRequest,
  { params }: { params: { platform: string } }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const platform = params.platform.toUpperCase()
    const sellerId = user.role === 'ADMIN'
      ? (new URL(req.url).searchParams.get('sellerId') || user.id)
      : user.id

    const integration = await db.integration.findUnique({
      where: {
        sellerId_platform: { sellerId, platform }
      }
    })

    if (!integration) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN' && integration.sellerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.integration.delete({
      where: { id: integration.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Settings:Webhooks] DELETE error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
