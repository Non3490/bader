import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { db } from '@/lib/db'
import { mapShopifyOrder, type ShopifyOrderPayload } from '@/lib/webhook-mappers'
import { createOrderFromWebhook, getWebhookUserId } from '@/lib/order-service'

export async function POST(request: NextRequest) {
  console.log('[webhook:shopify] Incoming request')

  // 1. Fetch secret from DB
  const setting = await db.systemSetting.findUnique({
    where: { key: 'webhook_secret_shopify' }
  })

  if (!setting?.value) {
    console.log('[webhook:shopify] Not configured — returning 503')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  // 2. Read raw body BEFORE parsing JSON (required for HMAC verification)
  const rawBody = await request.text()

  // 3. Verify Shopify HMAC-SHA256 signature
  const signature = request.headers.get('x-shopify-hmac-sha256')
  const expectedSig = createHmac('sha256', setting.value)
    .update(rawBody, 'utf8')
    .digest('base64')

  if (!signature || signature !== expectedSig) {
    console.log('[webhook:shopify] Invalid HMAC signature')
    // Return 200 to prevent Shopify from retrying invalid requests
    return NextResponse.json({ ok: false, reason: 'invalid_signature' })
  }

  // 4. Only process order creation events
  const topic = request.headers.get('x-shopify-topic')
  console.log('[webhook:shopify] Topic:', topic)

  if (topic !== 'orders/create') {
    return NextResponse.json({ ok: true, reason: 'ignored_topic' })
  }

  // 5. Parse payload
  let payload: ShopifyOrderPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    console.error('[webhook:shopify] Invalid JSON body')
    return NextResponse.json({ ok: false, reason: 'invalid_json' })
  }

  // 6. Map to standard order format
  const orderInput = mapShopifyOrder(payload)
  console.log('[webhook:shopify] Mapped order for:', orderInput.recipientName, '|', orderInput.city)

  // 7. Get admin user as order owner
  const adminUserId = await getWebhookUserId()
  if (!adminUserId) {
    console.error('[webhook:shopify] No active ADMIN user found in DB')
    return NextResponse.json({ ok: false, reason: 'no_admin_user' })
  }

  // 8. Create order (with dedup check)
  const result = await createOrderFromWebhook(orderInput, adminUserId)

  if ('duplicate' in result) {
    console.log('[webhook:shopify] Duplicate order skipped for phone:', orderInput.phone)
    return NextResponse.json({ ok: true, reason: 'duplicate' })
  }

  console.log('[webhook:shopify] Order created:', result.created.trackingNumber)
  return NextResponse.json({ ok: true, trackingNumber: result.created.trackingNumber })
}
