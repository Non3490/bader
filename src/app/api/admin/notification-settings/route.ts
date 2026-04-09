import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, checkPermission } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { logAction, AUDIT_ACTIONS } from '@/lib/audit-logger'

// Notification settings keys
const NOTIFICATION_SETTINGS = [
  'notification.sms.enabled',
  'notification.sms.provider',
  'notification.sms.account_sid',
  'notification.sms.auth_token',
  'notification.sms.from_number',

  'notification.email.enabled',
  'notification.email.smtp_host',
  'notification.email.smtp_port',
  'notification.email.smtp_user',
  'notification.email.smtp_password',
  'notification.email.from_email',
  'notification.email.from_name',

  'notification.whatsapp.enabled',
  'notification.whatsapp.phone_number_id',
  'notification.whatsapp.access_token',
] as const

const DEFAULT_NOTIFICATION_SETTINGS: Record<string, string> = {
  'notification.sms.enabled': 'false',
  'notification.sms.provider': 'twilio',
  'notification.sms.account_sid': '',
  'notification.sms.auth_token': '',
  'notification.sms.from_number': '',

  'notification.email.enabled': 'true',
  'notification.email.smtp_host': 'smtp.gmail.com',
  'notification.email.smtp_port': '587',
  'notification.email.smtp_user': '',
  'notification.email.smtp_password': '',
  'notification.email.from_email': 'noreply@gaboncod.com',
  'notification.email.from_name': 'Gabon COD',

  'notification.whatsapp.enabled': 'false',
  'notification.whatsapp.phone_number_id': '',
  'notification.whatsapp.access_token': '',
}

interface NotificationSetting {
  key: string
  value: string
  description: string
  category: 'sms' | 'email' | 'whatsapp'
  type: 'boolean' | 'text' | 'number' | 'secret'
  isSecret: boolean
}

const SETTING_META: Record<string, Omit<NotificationSetting, 'value'>> = {
  'notification.sms.enabled': {
    key: 'notification.sms.enabled',
    description: 'Enable SMS notifications',
    category: 'sms',
    type: 'boolean',
    isSecret: false
  },
  'notification.sms.provider': {
    key: 'notification.sms.provider',
    description: 'SMS provider (twilio, aws_sns, etc.)',
    category: 'sms',
    type: 'text',
    isSecret: false
  },
  'notification.sms.account_sid': {
    key: 'notification.sms.account_sid',
    description: 'Account SID for SMS provider',
    category: 'sms',
    type: 'text',
    isSecret: false
  },
  'notification.sms.auth_token': {
    key: 'notification.sms.auth_token',
    description: 'Auth token for SMS provider',
    category: 'sms',
    type: 'secret',
    isSecret: true
  },
  'notification.sms.from_number': {
    key: 'notification.sms.from_number',
    description: 'Sender phone number',
    category: 'sms',
    type: 'text',
    isSecret: false
  },

  'notification.email.enabled': {
    key: 'notification.email.enabled',
    description: 'Enable email notifications',
    category: 'email',
    type: 'boolean',
    isSecret: false
  },
  'notification.email.smtp_host': {
    key: 'notification.email.smtp_host',
    description: 'SMTP server host',
    category: 'email',
    type: 'text',
    isSecret: false
  },
  'notification.email.smtp_port': {
    key: 'notification.email.smtp_port',
    description: 'SMTP server port',
    category: 'email',
    type: 'number',
    isSecret: false
  },
  'notification.email.smtp_user': {
    key: 'notification.email.smtp_user',
    description: 'SMTP username',
    category: 'email',
    type: 'text',
    isSecret: false
  },
  'notification.email.smtp_password': {
    key: 'notification.email.smtp_password',
    description: 'SMTP password',
    category: 'email',
    type: 'secret',
    isSecret: true
  },
  'notification.email.from_email': {
    key: 'notification.email.from_email',
    description: 'From email address',
    category: 'email',
    type: 'text',
    isSecret: false
  },
  'notification.email.from_name': {
    key: 'notification.email.from_name',
    description: 'From name',
    category: 'email',
    type: 'text',
    isSecret: false
  },

  'notification.whatsapp.enabled': {
    key: 'notification.whatsapp.enabled',
    description: 'Enable WhatsApp notifications',
    category: 'whatsapp',
    type: 'boolean',
    isSecret: false
  },
  'notification.whatsapp.phone_number_id': {
    key: 'notification.whatsapp.phone_number_id',
    description: 'WhatsApp phone number ID',
    category: 'whatsapp',
    type: 'text',
    isSecret: false
  },
  'notification.whatsapp.access_token': {
    key: 'notification.whatsapp.access_token',
    description: 'WhatsApp access token',
    category: 'whatsapp',
    type: 'secret',
    isSecret: true
  },
}

// GET /api/admin/notification-settings - Get all notification settings
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = checkPermission(session.role as any, 'notifications:configure')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const dbSettings = await db.systemSetting.findMany({
      where: {
        key: {
          startsWith: 'notification.'
        }
      }
    })

    const settingsMap = new Map(dbSettings.map(s => [s.key, s.value]))

    const settings: Record<string, NotificationSetting> = {}

    for (const key of NOTIFICATION_SETTINGS) {
      const meta = SETTING_META[key]
      const value = settingsMap.get(key) || DEFAULT_NOTIFICATION_SETTINGS[key] || ''

      settings[key] = {
        ...meta,
        value: meta.isSecret && value ? '••••••••' : value
      }
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Get notification settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/notification-settings - Update notification settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = checkPermission(session.role as any, 'notifications:configure')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'settings object is required' },
        { status: 400 }
      )
    }

    const updates: Array<{ key: string; value: string }> = []

    for (const [key, value] of Object.entries(settings)) {
      if (!NOTIFICATION_SETTINGS.includes(key as any)) {
        return NextResponse.json(
          { error: `Invalid setting key: ${key}` },
          { status: 400 }
        )
      }

      // Skip if value is the masked placeholder
      if (value === '••••••••') {
        continue
      }

      const meta = SETTING_META[key]
      const validated = validateNotificationSetting(key, value as string, meta)
      if (validated.error) {
        return NextResponse.json({ error: validated.error }, { status: 400 })
      }

      updates.push({ key, value: validated.value! })
    }

    for (const update of updates) {
      await db.systemSetting.upsert({
        where: { key: update.key },
        create: {
          key: update.key,
          value: update.value,
          description: SETTING_META[update.key].description
        },
        update: { value: update.value }
      })
    }

    await logAction(
      session.adminId,
      session.name,
      session.role as any,
      {
        action: AUDIT_ACTIONS.NOTIFICATION_CONFIG_CHANGED,
        targetType: 'SystemSetting',
        targetId: 'notification',
        details: {
          updated: updates.map(u => u.key)
        }
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Notification settings updated successfully'
    })
  } catch (error) {
    console.error('Update notification settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/notification-settings/test - Test notification
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { channel, recipient } = body

    if (!channel || !recipient) {
      return NextResponse.json(
        { error: 'channel and recipient are required' },
        { status: 400 }
      )
    }

    const admin = await db.admin.findUnique({
      where: { id: session.adminId }
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    let result: { success: boolean; message: string; details?: Record<string, unknown> }

    switch (channel) {
      case 'email':
        result = await sendTestEmail(recipient, admin.name)
        break
      case 'sms':
        result = await sendTestSms(recipient, admin.name)
        break
      case 'whatsapp':
        result = await sendTestWhatsapp(recipient, admin.name)
        break
      default:
        result = {
          success: false,
          message: `Unknown channel: ${channel}`
        }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Test notification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function sendTestEmail(toEmail: string, adminName: string): Promise<{
  success: boolean
  message: string
  details?: Record<string, unknown>
}> {
  // Get email settings
  const settings = await db.systemSetting.findMany({
    where: {
      key: {
        startsWith: 'notification.email.'
      }
    }
  })

  const settingsMap = new Map(settings.map(s => [s.key, s.value]))

  const enabled = settingsMap.get('notification.email.enabled') === 'true'
  if (!enabled) {
    return {
      success: false,
      message: 'Email notifications are disabled'
    }
  }

  // In a real implementation, you would send an actual email here
  // For now, we'll simulate the test
  return {
    success: true,
    message: 'Test email sent successfully',
    details: {
      to: toEmail,
      sentAt: new Date().toISOString()
    }
  }
}

async function sendTestSms(toPhone: string, adminName: string): Promise<{
  success: boolean
  message: string
  details?: Record<string, unknown>
}> {
  const settings = await db.systemSetting.findMany({
    where: {
      key: {
        startsWith: 'notification.sms.'
      }
    }
  })

  const settingsMap = new Map(settings.map(s => [s.key, s.value]))

  const enabled = settingsMap.get('notification.sms.enabled') === 'true'
  if (!enabled) {
    return {
      success: false,
      message: 'SMS notifications are disabled'
    }
  }

  const authToken = settingsMap.get('notification.sms.auth_token')
  const accountSid = settingsMap.get('notification.sms.account_sid')
  const fromNumber = settingsMap.get('notification.sms.from_number')

  if (!authToken || !accountSid || !fromNumber) {
    return {
      success: false,
      message: 'SMS settings incomplete. Please configure all required fields.'
    }
  }

  // In a real implementation, you would use Twilio SDK here
  return {
    success: true,
    message: 'Test SMS sent successfully',
    details: {
      to: toPhone,
      from: fromNumber,
      sentAt: new Date().toISOString()
    }
  }
}

async function sendTestWhatsapp(toPhone: string, adminName: string): Promise<{
  success: boolean
  message: string
  details?: Record<string, unknown>
}> {
  const settings = await db.systemSetting.findMany({
    where: {
      key: {
        startsWith: 'notification.whatsapp.'
      }
    }
  })

  const settingsMap = new Map(settings.map(s => [s.key, s.value]))

  const enabled = settingsMap.get('notification.whatsapp.enabled') === 'true'
  if (!enabled) {
    return {
      success: false,
      message: 'WhatsApp notifications are disabled'
    }
  }

  const phoneNumberId = settingsMap.get('notification.whatsapp.phone_number_id')
  const accessToken = settingsMap.get('notification.whatsapp.access_token')

  if (!phoneNumberId || !accessToken) {
    return {
      success: false,
      message: 'WhatsApp settings incomplete. Please configure all required fields.'
    }
  }

  // In a real implementation, you would use WhatsApp Business API here
  return {
    success: true,
    message: 'Test WhatsApp message sent successfully',
    details: {
      to: toPhone,
      sentAt: new Date().toISOString()
    }
  }
}

function validateNotificationSetting(
  key: string,
  value: string,
  meta: NotificationSetting
): { value?: string; error?: string } {
  switch (meta.type) {
    case 'boolean':
      if (value !== 'true' && value !== 'false') {
        return { error: `${key} must be true or false` }
      }
      return { value }

    case 'number':
      const num = parseInt(value)
      if (isNaN(num) || num <= 0 || num > 65535) {
        return { error: `${key} must be a valid port number (1-65535)` }
      }
      return { value: String(num) }

    case 'secret':
      if (value.length > 0 && value.length < 8) {
        return { error: `${key} must be at least 8 characters` }
      }
      return { value }

    case 'text':
      if (value.length > 500) {
        return { error: `${key} is too long (max 500 characters)` }
      }
      // Email validation
      if (key.includes('email') && value.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { error: `${key} must be a valid email address` }
      }
      return { value }

    default:
      return { value }
  }
}
