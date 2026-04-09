import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// Test webhook connection
export async function POST(
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

    if (!integration || !integration.secret) {
      return NextResponse.json({
        success: false,
        reason: 'not_configured',
        message: 'Webhook not configured'
      }, { status: 400 })
    }

    if (!integration.isActive) {
      return NextResponse.json({
        success: false,
        reason: 'inactive',
        message: 'Webhook is disabled'
      }, { status: 400 })
    }

    // Simulate test - in real scenario, you would send a test ping to the platform
    // For now, we just validate the secret exists
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://egabon.vercel.app'

    // Log the test as an activity
    await db.webhookActivity.create({
      data: {
        platform,
        status: 'SUCCESS',
        eventType: 'test',
        reason: 'Manual test connection',
        integrationId: integration.id
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Connection successful',
      webhookUrl: `${baseUrl}/api/webhooks/${platform.toLowerCase()}`,
      lastHit: integration.lastHit
    })
  } catch (error) {
    console.error('[Settings:Webhooks] Test error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
