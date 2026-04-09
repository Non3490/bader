import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

/**
 * GET /api/settings/twilio
 * Get Twilio configuration (ADMIN only)
 * Returns masked sensitive data
 */
export async function GET() {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const settings = await db.twilioSettings.findFirst()

    if (!settings) {
      return NextResponse.json({
        configured: false,
        data: null
      })
    }

    // Mask sensitive data
    const maskedData = {
      accountSid: settings.accountSid,
      authToken: settings.authToken ? settings.authToken.substring(0, 8) + '...' : '',
      apiKey: settings.apiKey,
      apiSecret: settings.apiSecret ? '***' : '',
      twimlAppSid: settings.twimlAppSid,
      phoneNumber: settings.phoneNumber,
      updatedAt: settings.updatedAt
    }

    return NextResponse.json({
      configured: true,
      data: maskedData
    })
  } catch (error) {
    console.error('Error fetching Twilio settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/settings/twilio
 * Save Twilio configuration (ADMIN only)
 */
export async function POST(request: NextRequest) {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { accountSid, authToken, apiKey, apiSecret, twimlAppSid, phoneNumber } = body

    if (!accountSid || !authToken || !apiKey || !apiSecret || !twimlAppSid || !phoneNumber) {
      return NextResponse.json({
        error: 'All Twilio fields are required'
      }, { status: 400 })
    }

    // Validate Account SID format
    if (!accountSid.startsWith('AC')) {
      return NextResponse.json({
        error: 'Invalid Account SID format (should start with AC)'
      }, { status: 400 })
    }

    // Validate phone number format
    if (!phoneNumber.match(/^\+\d{10,15}$/)) {
      return NextResponse.json({
        error: 'Invalid phone number format (should be E.164 format, e.g., +212600000000)'
      }, { status: 400 })
    }

    const existing = await db.twilioSettings.findFirst()

    if (existing) {
      // Update existing
      await db.twilioSettings.update({
        where: { id: existing.id },
        data: {
          accountSid,
          authToken,
          apiKey,
          apiSecret,
          twimlAppSid,
          phoneNumber
        }
      })

      await logActivity(
        user.id,
        user.role,
        'TWILIO_SETTINGS_UPDATE',
        'Updated Twilio configuration'
      )
    } else {
      // Create new
      await db.twilioSettings.create({
        data: {
          accountSid,
          authToken,
          apiKey,
          apiSecret,
          twimlAppSid,
          phoneNumber
        }
      })

      await logActivity(
        user.id,
        user.role,
        'TWILIO_SETTINGS_CREATE',
        'Created Twilio configuration'
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving Twilio settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/twilio
 * Delete Twilio configuration (ADMIN only)
 */
export async function DELETE() {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    await db.twilioSettings.deleteMany()

    await logActivity(
      user.id,
      user.role,
      'TWILIO_SETTINGS_DELETE',
      'Deleted Twilio configuration'
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting Twilio settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
