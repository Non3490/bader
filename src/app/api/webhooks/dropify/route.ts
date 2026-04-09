import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapDropifyOrder, type DropifyOrderPayload } from '@/lib/webhook-mappers'
import { createOrderFromWebhook, getWebhookUserId } from '@/lib/order-service'

export async function POST(request: NextRequest) {
  console.log('[webhook:dropify] Incoming request')

  // 1. Fetch secret from DB
  const setting = await db.systemSetting.findUnique({
    where: { key: 'webhook_secret_dropify' }
  })

  if (!setting?.value) {
    console.log('[webhook:dropify] Not configured — returning 503')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  // 2. Verify custom header secret (Dropify sends X-Dropify-Secret: {secret})
  const secret = request.headers.get('x-dropify-secret')

  if (!secret || secret !== setting.value) {
    console.log('[webhook:dropify] Invalid secret header')
    return NextResponse.json({ ok: false, reason: 'invalid_secret' })
  }

  // 3. Only process order creation events
  const topic =
    request.headers.get('x-dropify-event') ??
    request.headers.get('x-event-type')
  console.log('[webhook:dropify] Topic:', topic)

  if (topic && topic !== 'order.created') {
    return NextResponse.json({ ok: true, reason: 'ignored_topic' })
  }

  // 4. Parse payload
  let payload: DropifyOrderPayload
  try {
    payload = await request.json()
  } catch {
    console.error('[webhook:dropify] Invalid JSON body')
    return NextResponse.json({ ok: false, reason: 'invalid_json' })
  }

  // 5. Map to standard order format
  const orderInput = mapDropifyOrder(payload)
  console.log('[webhook:dropify] Mapped order for:', orderInput.recipientName, '|', orderInput.city)

  // 6. Get admin user as order owner
  const adminUserId = await getWebhookUserId()
  if (!adminUserId) {
    console.error('[webhook:dropify] No active ADMIN user found in DB')
    return NextResponse.json({ ok: false, reason: 'no_admin_user' })
  }

  // 7. Create order (with dedup check)
  const result = await createOrderFromWebhook(orderInput, adminUserId)

  if ('duplicate' in result) {
    console.log('[webhook:dropify] Duplicate order skipped for phone:', orderInput.phone)
    return NextResponse.json({ ok: true, reason: 'duplicate' })
  }

  console.log('[webhook:dropify] Order created:', result.created.trackingNumber)
  return NextResponse.json({ ok: true, trackingNumber: result.created.trackingNumber })
}
