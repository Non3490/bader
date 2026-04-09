import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, checkPermission } from '@/lib/admin-auth'
import { db } from '@/lib/db'

// Business settings keys
const BUSINESS_SETTINGS_KEYS = [
  'business.name',
  'business.logo',
  'business.email',
  'business.phone',
  'business.address',
  'business.city',
  'business.country',
  'tax.rate',
  'tax.included',
  'currency.code',
  'currency.symbol',
  'delivery.radius_km',
  'delivery.min_fee',
  'delivery.base_fee',
  'delivery.zone_fees',
  'hours.monday',
  'hours.tuesday',
  'hours.wednesday',
  'hours.thursday',
  'hours.friday',
  'hours.saturday',
  'hours.sunday',
  'holidays',
] as const

// Default business settings
const DEFAULT_BUSINESS_SETTINGS: Record<string, string> = {
  'business.name': 'Gabon COD Platform',
  'business.logo': '',
  'business.email': 'contact@gaboncod.com',
  'business.phone': '+241 XX XX XX XX',
  'business.address': '',
  'business.city': 'Libreville',
  'business.country': 'Gabon',
  'tax.rate': '18',
  'tax.included': 'true',
  'currency.code': 'XAF',
  'currency.symbol': 'FCFA',
  'delivery.radius_km': '50',
  'delivery.min_fee': '1000',
  'delivery.base_fee': '2000',
  'delivery.zone_fees': '{}',
  'hours.monday': '08:00-18:00',
  'hours.tuesday': '08:00-18:00',
  'hours.wednesday': '08:00-18:00',
  'hours.thursday': '08:00-18:00',
  'hours.friday': '08:00-18:00',
  'hours.saturday': '09:00-14:00',
  'hours.sunday': 'closed',
  'holidays': '[]',
}

interface BusinessSetting {
  key: string
  value: string
  description?: string
  category: 'business' | 'tax' | 'currency' | 'delivery' | 'hours'
  type: 'text' | 'number' | 'boolean' | 'json' | 'image'
}

const SETTING_META: Record<string, Omit<BusinessSetting, 'value'>> = {
  'business.name': {
    key: 'business.name',
    description: 'Business name displayed on invoices and receipts',
    category: 'business',
    type: 'text'
  },
  'business.logo': {
    key: 'business.logo',
    description: 'URL to business logo image',
    category: 'business',
    type: 'image'
  },
  'business.email': {
    key: 'business.email',
    description: 'Contact email address',
    category: 'business',
    type: 'text'
  },
  'business.phone': {
    key: 'business.phone',
    description: 'Contact phone number',
    category: 'business',
    type: 'text'
  },
  'business.address': {
    key: 'business.address',
    description: 'Business address',
    category: 'business',
    type: 'text'
  },
  'business.city': {
    key: 'business.city',
    description: 'City where business is located',
    category: 'business',
    type: 'text'
  },
  'business.country': {
    key: 'business.country',
    description: 'Country where business is located',
    category: 'business',
    type: 'text'
  },
  'tax.rate': {
    key: 'tax.rate',
    description: 'Tax rate percentage (e.g., 18 for 18%)',
    category: 'tax',
    type: 'number'
  },
  'tax.included': {
    key: 'tax.included',
    description: 'Whether tax is included in displayed prices',
    category: 'tax',
    type: 'boolean'
  },
  'currency.code': {
    key: 'currency.code',
    description: 'ISO currency code (e.g., XAF, USD, EUR)',
    category: 'currency',
    type: 'text'
  },
  'currency.symbol': {
    key: 'currency.symbol',
    description: 'Currency symbol displayed to users (e.g., FCFA, $, €)',
    category: 'currency',
    type: 'text'
  },
  'delivery.radius_km': {
    key: 'delivery.radius_km',
    description: 'Maximum delivery radius in kilometers',
    category: 'delivery',
    type: 'number'
  },
  'delivery.min_fee': {
    key: 'delivery.min_fee',
    description: 'Minimum delivery fee',
    category: 'delivery',
    type: 'number'
  },
  'delivery.base_fee': {
    key: 'delivery.base_fee',
    description: 'Base delivery fee for standard delivery',
    category: 'delivery',
    type: 'number'
  },
  'delivery.zone_fees': {
    key: 'delivery.zone_fees',
    description: 'JSON object mapping zone names to additional fees',
    category: 'delivery',
    type: 'json'
  },
  'hours.monday': {
    key: 'hours.monday',
    description: 'Operating hours for Monday (format: HH:MM-HH:MM or "closed")',
    category: 'hours',
    type: 'text'
  },
  'hours.tuesday': {
    key: 'hours.tuesday',
    description: 'Operating hours for Tuesday',
    category: 'hours',
    type: 'text'
  },
  'hours.wednesday': {
    key: 'hours.wednesday',
    description: 'Operating hours for Wednesday',
    category: 'hours',
    type: 'text'
  },
  'hours.thursday': {
    key: 'hours.thursday',
    description: 'Operating hours for Thursday',
    category: 'hours',
    type: 'text'
  },
  'hours.friday': {
    key: 'hours.friday',
    description: 'Operating hours for Friday',
    category: 'hours',
    type: 'text'
  },
  'hours.saturday': {
    key: 'hours.saturday',
    description: 'Operating hours for Saturday',
    category: 'hours',
    type: 'text'
  },
  'hours.sunday': {
    key: 'hours.sunday',
    description: 'Operating hours for Sunday',
    category: 'hours',
    type: 'text'
  },
  'holidays': {
    key: 'holidays',
    description: 'JSON array of holiday dates (format: YYYY-MM-DD)',
    category: 'hours',
    type: 'json'
  },
}

// GET /api/admin/settings - Get all business settings
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = checkPermission(session.role as any, '*')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch all settings from database
    const dbSettings = await db.systemSetting.findMany({
      where: {
        key: {
          in: Array.from(BUSINESS_SETTINGS_KEYS)
        }
      }
    })

    const settingsMap = new Map(dbSettings.map(s => [s.key, s.value]))

    const settings: Record<string, BusinessSetting> = {}

    for (const key of BUSINESS_SETTINGS_KEYS) {
      const meta = SETTING_META[key]
      settings[key] = {
        ...meta,
        value: settingsMap.get(key) || DEFAULT_BUSINESS_SETTINGS[key] || ''
      }
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Get business settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/settings - Update business settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = checkPermission(session.role as any, '*')
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

    // Validate settings
    const updates: Array<{ key: string; value: string; oldValue: string }> = []

    for (const [key, value] of Object.entries(settings)) {
      if (!BUSINESS_SETTINGS_KEYS.includes(key as any)) {
        return NextResponse.json(
          { error: `Invalid setting key: ${key}` },
          { status: 400 }
        )
      }

      const meta = SETTING_META[key]
      const validatedValue = validateSettingValue(key, value as string, meta.type)
      if (validatedValue.error) {
        return NextResponse.json(
          { error: validatedValue.error },
          { status: 400 }
        )
      }

      // Get old value for audit log
      const oldSetting = await db.systemSetting.findUnique({
        where: { key }
      })

      updates.push({
        key,
        value: validatedValue.value!,
        oldValue: oldSetting?.value || DEFAULT_BUSINESS_SETTINGS[key] || ''
      })
    }

    // Update settings
    const { logSettingsUpdate } = await import('@/lib/audit-logger')

    for (const update of updates) {
      await db.systemSetting.upsert({
        where: { key: update.key },
        create: {
          key: update.key,
          value: update.value,
          description: SETTING_META[update.key].description
        },
        update: {
          value: update.value
        }
      })

      // Log the change
      await logSettingsUpdate(
        session.adminId,
        session.name,
        session.role as any,
        update.key,
        update.oldValue,
        update.value
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully'
    })
  } catch (error) {
    console.error('Update business settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function validateSettingValue(
  key: string,
  value: string,
  type: string
): { value?: string; error?: string } {
  switch (type) {
    case 'number':
      const num = parseFloat(value)
      if (isNaN(num)) {
        return { error: `${key} must be a valid number` }
      }
      if (num < 0) {
        return { error: `${key} must be positive` }
      }
      return { value: String(num) }

    case 'boolean':
      if (value !== 'true' && value !== 'false') {
        return { error: `${key} must be true or false` }
      }
      return { value }

    case 'json':
      try {
        JSON.parse(value)
        return { value }
      } catch {
        return { error: `${key} must be valid JSON` }
      }

    case 'text':
    case 'image':
      if (value.length > 1000) {
        return { error: `${key} is too long (max 1000 characters)` }
      }
      return { value }

    default:
      return { value }
  }
}
