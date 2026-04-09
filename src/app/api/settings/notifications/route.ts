import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

const NOTIFICATION_SETTINGS_KEY = 'notification_settings'

/**
 * GET /api/settings/notifications
 * Get notification settings (ADMIN only)
 */
export async function GET() {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const setting = await db.systemSetting.findUnique({
      where: { key: NOTIFICATION_SETTINGS_KEY }
    })

    const defaultSettings = {
      smsEnabled: true,
      whatsappEnabled: false,
      smsTemplateConfirmed: 'Bonjour {name}, votre commande #{code} a été confirmée. Vous serez livré sous 2-3 jours ouvrables.',
      smsTemplateShipped: 'Bonjour {name}, votre commande #{code} est en route. Numéro de suivi: {tracking}. Préparez {amount} MAD.',
      smsTemplateDelivered: 'Bonjour {name}, votre commande #{code} a été livrée avec succès. Merci de votre confiance!',
      smsTemplateReturned: 'Bonjour {name}, votre commande #{code} n\'a pas pu être livrée. Nous vous recontacterons.'
    }

    if (setting?.value) {
      return NextResponse.json({
        settings: { ...defaultSettings, ...JSON.parse(setting.value) }
      })
    }

    return NextResponse.json({ settings: defaultSettings })
  } catch (error) {
    console.error('Error fetching notification settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/settings/notifications
 * Save notification settings (ADMIN only)
 */
export async function POST(request: NextRequest) {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await request.json()

    // Validate required fields
    const {
      smsEnabled,
      whatsappEnabled,
      smsTemplateConfirmed,
      smsTemplateShipped,
      smsTemplateDelivered,
      smsTemplateReturned
    } = body

    if (typeof smsEnabled !== 'boolean' || typeof whatsappEnabled !== 'boolean') {
      return NextResponse.json({
        error: 'smsEnabled and whatsappEnabled must be boolean values'
      }, { status: 400 })
    }

    if (!smsTemplateConfirmed || !smsTemplateShipped || !smsTemplateDelivered || !smsTemplateReturned) {
      return NextResponse.json({
        error: 'All SMS templates are required'
      }, { status: 400 })
    }

    const settingsValue = JSON.stringify({
      smsEnabled,
      whatsappEnabled,
      smsTemplateConfirmed,
      smsTemplateShipped,
      smsTemplateDelivered,
      smsTemplateReturned
    })

    await db.systemSetting.upsert({
      where: { key: NOTIFICATION_SETTINGS_KEY },
      update: { value: settingsValue },
      create: {
        key: NOTIFICATION_SETTINGS_KEY,
        value: settingsValue,
        description: 'SMS and WhatsApp notification settings and templates'
      }
    })

    await logActivity(
      user.id,
      user.role,
      'NOTIFICATION_SETTINGS_UPDATE',
      'Updated notification settings'
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving notification settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
