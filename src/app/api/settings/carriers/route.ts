import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

/**
 * GET /api/settings/carriers
 * Get all carrier configurations
 * ADMIN only
 */
export async function GET(request: NextRequest) {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const carriers = await db.carrierSettings.findMany({
      orderBy: { name: 'asc' }
    })

    // Mask API secrets in response
    const maskedCarriers = carriers.map(carrier => ({
      ...carrier,
      apiSecret: carrier.apiSecret ? '***' : null
    }))

    return NextResponse.json({ data: maskedCarriers })
  } catch (error) {
    console.error('Error fetching carriers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/settings/carriers
 * Add or update carrier configuration
 * ADMIN only
 */
export async function POST(request: NextRequest) {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { id, name, apiKey, apiSecret, isActive, webhookUrl } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    // Validate carrier name
    const validCarriers = ['shipsen', 'colisswift', 'afriquecod']
    if (!validCarriers.includes(name.toLowerCase())) {
      return NextResponse.json({ error: `Invalid carrier. Must be one of: ${validCarriers.join(', ')}` }, { status: 400 })
    }

    // Upsert carrier settings
    const existing = await db.carrierSettings.findFirst({
      where: { name: name.toLowerCase() }
    })

    let carrier
    if (existing && (!id || id === existing.id)) {
      // Update existing
      carrier = await db.carrierSettings.update({
        where: { id: existing.id },
        data: {
          apiKey: apiKey ?? existing.apiKey,
          apiSecret: apiSecret ?? existing.apiSecret,
          isActive: isActive ?? existing.isActive,
          webhookUrl: webhookUrl ?? existing.webhookUrl
        }
      })

      await logActivity(
        user.id,
        user.role,
        'CARRIER_SETTINGS_UPDATE',
        `Updated ${name.toUpperCase()} carrier settings`
      )
    } else if (existing && apiSecret) {
      // Don't update secret if it's already set and not provided
      return NextResponse.json({
        error: 'Cannot update API secret without providing new value',
        tip: 'Please provide apiSecret to update, or omit to keep existing secret'
      }, { status: 400 })
    } else {
      // Create new
      carrier = await db.carrierSettings.create({
        data: {
          name: name.toLowerCase(),
          apiKey: apiKey,
          apiSecret,
          isActive: isActive ?? true,
          webhookUrl
        }
      })

      await logActivity(
        user.id,
        user.role,
        'CARRIER_SETTINGS_CREATE',
        `Created ${name.toUpperCase()} carrier configuration`
      )
    }

    return NextResponse.json({
      success: true,
      carrier: {
        id: carrier.id,
        name: carrier.name,
        isActive: carrier.isActive,
        // Don't return secrets
        hasApiKey: !!carrier.apiKey,
        hasApiSecret: !!carrier.apiSecret,
        hasWebhookUrl: !!carrier.webhookUrl
      }
    }, { status: existing ? 200 : 201 })
  } catch (error) {
    console.error('Error saving carrier settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/carriers/[id]
 * Delete carrier configuration
 * ADMIN only
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params

  try {
    const carrier = await db.carrierSettings.findUnique({
      where: { id }
    })

    if (!carrier) {
      return NextResponse.json({ error: 'Carrier not found' }, { status: 404 })
    }

    await db.carrierSettings.delete({
      where: { id }
    })

    await logActivity(
      user.id,
      user.role,
      'CARRIER_SETTINGS_DELETE',
      `Deleted ${carrier.name.toUpperCase()} carrier configuration`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting carrier settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
