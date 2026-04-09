import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

const ALLOWED_KEYS = [
  'webhook_secret_shopify',
  'webhook_secret_youcan',
  'webhook_secret_dropify'
]

// GET /api/settings — Get platform settings (admin) or seller settings
export async function GET() {
  const user = await getSession()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    // Get webhook settings for admin
    const settings = await db.systemSetting.findMany({
      where: { key: { in: ALLOWED_KEYS } }
    })

    const result: Record<string, { configured: boolean; description: string | null }> = {}

    for (const key of ALLOWED_KEYS) {
      const setting = settings.find((s) => s.key === key)
      result[key] = {
        configured: !!(setting?.value),
        description: setting?.description ?? null
      }
    }

    return NextResponse.json({ settings: result, type: 'platform' })
  }

  // Seller settings — return user profile
  const seller = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    }
  })

  return NextResponse.json({ settings: seller, type: 'seller' })
}

// PATCH /api/settings — upsert a single webhook secret (ADMIN only)
export async function PATCH(request: NextRequest) {
  const user = await getSession()

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { key, value } = body

  if (!key || !ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: 'Invalid setting key' }, { status: 400 })
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return NextResponse.json({ error: 'Value must be a non-empty string' }, { status: 400 })
  }

  const platformName = key.replace('webhook_secret_', '')

  await db.systemSetting.upsert({
    where: { key },
    update: { value: value.trim() },
    create: {
      key,
      value: value.trim(),
      description: `Webhook secret for ${platformName}`
    }
  })

  return NextResponse.json({ ok: true })
}

// PUT /api/settings — Update settings
export async function PUT(req: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      // Update platform settings (webhook secrets)
      const allowed = ['webhook_secret_shopify', 'webhook_secret_youcan', 'webhook_secret_dropify']
      const updates = []

      for (const key of allowed) {
        if (key in body && body[key]) {
          const platformName = key.replace('webhook_secret_', '')
          updates.push(
            db.systemSetting.upsert({
              where: { key },
              update: { value: body[key].trim() },
              create: {
                key,
                value: body[key].trim(),
                description: `Webhook secret for ${platformName}`
              }
            })
          )
        }
      }

      if (updates.length > 0) {
        await Promise.all(updates)
      }

      // Return updated settings
      const settings = await db.systemSetting.findMany({
        where: { key: { in: ALLOWED_KEYS } }
      })

      const result: Record<string, { configured: boolean; description: string | null }> = {}
      for (const key of ALLOWED_KEYS) {
        const setting = settings.find((s) => s.key === key)
        result[key] = {
          configured: !!(setting?.value),
          description: setting?.description ?? null
        }
      }

      return NextResponse.json({ settings: result, ok: true, type: 'platform' })
    }

    // Seller can update their own profile
    const allowedSellerFields = ['name', 'phone']
    const safeBody: Record<string, any> = {}
    for (const key of allowedSellerFields) {
      if (key in body) safeBody[key] = body[key]
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: safeBody,
      select: { id: true, name: true, email: true, phone: true }
    })

    return NextResponse.json({ settings: updated, ok: true, type: 'seller' })
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/settings — remove a webhook secret (ADMIN only)
export async function DELETE(request: NextRequest) {
  const user = await getSession()

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const key = searchParams.get('key')

  if (!key || !ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: 'Invalid setting key' }, { status: 400 })
  }

  await db.systemSetting.deleteMany({ where: { key } })

  return NextResponse.json({ ok: true })
}
