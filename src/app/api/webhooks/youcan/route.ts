import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapYouCanOrder, type YouCanOrderPayload } from '@/lib/webhook-mappers'
import { createOrderFromWebhook, getWebhookUserId } from '@/lib/order-service'

export async function POST(request: NextRequest) {
  console.log('[webhook:youcan] Incoming request')

  // 1. Fetch secret from DB
  const setting = await db.systemSetting.findUnique({
    where: { key: 'webhook_secret_youcan' }
  })

  if (!setting?.value) {
    console.log('[webhook:youcan] Not configured — returning 503')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  // 2. Verify Bearer token (YouCan sends Authorization: Bearer {secret})
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token || token !== setting.value) {
    console.log('[webhook:youcan] Invalid token')
    return NextResponse.json({ ok: false, reason: 'invalid_token' })
  }

  // 3. Only process order creation events
  const topic =
    request.headers.get('x-youcan-topic') ??
    request.headers.get('x-event-type') ??
    request.headers.get('x-topic')
  console.log('[webhook:youcan] Topic:', topic)

  if (topic && topic !== 'order.created') {
    return NextResponse.json({ ok: true, reason: 'ignored_topic' })
  }

  // 4. Parse payload
  let payload: YouCanOrderPayload
  try {
    payload = await request.json()
  } catch {
    console.error('[webhook:youcan] Invalid JSON body')
    return NextResponse.json({ ok: false, reason: 'invalid_json' })
  }

  // 5. Map to standard order format
  const orderInput = mapYouCanOrder(payload)
  console.log('[webhook:youcan] Mapped order for:', orderInput.recipientName, '|', orderInput.city)

  // 6. Get admin user as order owner
  const adminUserId = await getWebhookUserId()
  if (!adminUserId) {
    console.error('[webhook:youcan] No active ADMIN user found in DB')
    return NextResponse.json({ ok: false, reason: 'no_admin_user' })
  }

  // 7. Create order (with dedup check)
  const result = await createOrderFromWebhook(orderInput, adminUserId)

  if ('duplicate' in result) {
    console.log('[webhook:youcan] Duplicate order skipped for phone:', orderInput.phone)
    return NextResponse.json({ ok: true, reason: 'duplicate' })
  }

  console.log('[webhook:youcan] Order created:', result.created.trackingNumber)
  return NextResponse.json({ ok: true, trackingNumber: result.created.trackingNumber })
}
