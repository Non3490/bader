import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { randomBytes } from 'crypto'
import { logActivity } from '@/lib/activity-logger'

function generateKey() {
  return 'gck_' + randomBytes(32).toString('hex')
}

// GET /api/api-key — get own key (masked)
export async function GET() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const apiKey = await db.apiKey.findUnique({ where: { sellerId: user.id } })
    if (!apiKey) return NextResponse.json({ apiKey: null })

    return NextResponse.json({
      apiKey: {
        id: apiKey.id,
        key: apiKey.key.slice(0, 12) + '••••••••••••••••••••••••••••',
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt
      }
    })
  } catch (error) {
    console.error('ApiKey GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/api-key — generate new key (or replace existing)
export async function POST() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const key = generateKey()
    const apiKey = await db.apiKey.upsert({
      where: { sellerId: user.id },
      create: { sellerId: user.id, key },
      update: { key }
    })

    logActivity(user.id, user.role, 'API_KEY_GENERATED', 'API key generated/regenerated').catch(() => {})

    // Return full key ONCE at generation time
    return NextResponse.json({ apiKey: { ...apiKey, key } }, { status: 201 })
  } catch (error) {
    console.error('ApiKey POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/api-key — revoke key
export async function DELETE() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    await db.apiKey.delete({ where: { sellerId: user.id } }).catch(() => {})
    logActivity(user.id, user.role, 'API_KEY_REVOKED', 'API key revoked').catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('ApiKey DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
