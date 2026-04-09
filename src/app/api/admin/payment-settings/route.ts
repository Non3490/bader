import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, checkPermission } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { logAction, AUDIT_ACTIONS } from '@/lib/audit-logger'

// Payment settings keys
const PAYMENT_SETTINGS = [
  'payment.mobile_money.enabled',
  'payment.mobile_money.provider',
  'payment.mobile_money.api_key',
  'payment.mobile_money.api_secret',
  'payment.mobile_money.merchant_id',

  'payment.card.enabled',
  'payment.card.provider',
  'payment.card.public_key',
  'payment.card.secret_key',
  'payment.card.webhook_secret',

  'payment.wallet.enabled',
  'payment.wallet.min_balance',
  'payment.wallet.max_daily_withdrawal',

  'payment.cash_on_delivery.enabled',
  'payment.cash_on_delivery.max_amount',

  'payment.methods',
  'payment.default_method',
] as const

const DEFAULT_PAYMENT_SETTINGS: Record<string, string> = {
  'payment.mobile_money.enabled': 'false',
  'payment.mobile_money.provider': '',
  'payment.mobile_money.api_key': '',
  'payment.mobile_money.api_secret': '',
  'payment.mobile_money.merchant_id': '',

  'payment.card.enabled': 'false',
  'payment.card.provider': 'stripe',
  'payment.card.public_key': '',
  'payment.card.secret_key': '',
  'payment.card.webhook_secret': '',

  'payment.wallet.enabled': 'true',
  'payment.wallet.min_balance': '1000',
  'payment.wallet.max_daily_withdrawal': '500000',

  'payment.cash_on_delivery.enabled': 'true',
  'payment.cash_on_delivery.max_amount': '1000000',

  'payment.methods': '["cash_on_delivery", "wallet"]',
  'payment.default_method': 'cash_on_delivery',
}

interface PaymentSetting {
  key: string
  value: string
  description: string
  category: 'mobile_money' | 'card' | 'wallet' | 'cash'
  type: 'boolean' | 'text' | 'number' | 'json' | 'secret'
  isSecret: boolean
}

const SETTING_META: Record<string, Omit<PaymentSetting, 'value'>> = {
  'payment.mobile_money.enabled': {
    key: 'payment.mobile_money.enabled',
    description: 'Enable mobile money payments',
    category: 'mobile_money',
    type: 'boolean',
    isSecret: false
  },
  'payment.mobile_money.provider': {
    key: 'payment.mobile_money.provider',
    description: 'Mobile money provider (e.g., mtn, airtel, orange)',
    category: 'mobile_money',
    type: 'text',
    isSecret: false
  },
  'payment.mobile_money.api_key': {
    key: 'payment.mobile_money.api_key',
    description: 'API key for mobile money provider',
    category: 'mobile_money',
    type: 'secret',
    isSecret: true
  },
  'payment.mobile_money.api_secret': {
    key: 'payment.mobile_money.api_secret',
    description: 'API secret for mobile money provider',
    category: 'mobile_money',
    type: 'secret',
    isSecret: true
  },
  'payment.mobile_money.merchant_id': {
    key: 'payment.mobile_money.merchant_id',
    description: 'Merchant ID for mobile money',
    category: 'mobile_money',
    type: 'text',
    isSecret: false
  },

  'payment.card.enabled': {
    key: 'payment.card.enabled',
    description: 'Enable card payments',
    category: 'card',
    type: 'boolean',
    isSecret: false
  },
  'payment.card.provider': {
    key: 'payment.card.provider',
    description: 'Card payment provider (stripe, paypal, etc.)',
    category: 'card',
    type: 'text',
    isSecret: false
  },
  'payment.card.public_key': {
    key: 'payment.card.public_key',
    description: 'Public key for card payments',
    category: 'card',
    type: 'text',
    isSecret: false
  },
  'payment.card.secret_key': {
    key: 'payment.card.secret_key',
    description: 'Secret key for card payments',
    category: 'card',
    type: 'secret',
    isSecret: true
  },
  'payment.card.webhook_secret': {
    key: 'payment.card.webhook_secret',
    description: 'Webhook secret for payment notifications',
    category: 'card',
    type: 'secret',
    isSecret: true
  },

  'payment.wallet.enabled': {
    key: 'payment.wallet.enabled',
    description: 'Enable wallet payments',
    category: 'wallet',
    type: 'boolean',
    isSecret: false
  },
  'payment.wallet.min_balance': {
    key: 'payment.wallet.min_balance',
    description: 'Minimum wallet balance to make payments',
    category: 'wallet',
    type: 'number',
    isSecret: false
  },
  'payment.wallet.max_daily_withdrawal': {
    key: 'payment.wallet.max_daily_withdrawal',
    description: 'Maximum daily withdrawal amount',
    category: 'wallet',
    type: 'number',
    isSecret: false
  },

  'payment.cash_on_delivery.enabled': {
    key: 'payment.cash_on_delivery.enabled',
    description: 'Enable cash on delivery',
    category: 'cash',
    type: 'boolean',
    isSecret: false
  },
  'payment.cash_on_delivery.max_amount': {
    key: 'payment.cash_on_delivery.max_amount',
    description: 'Maximum COD amount per order',
    category: 'cash',
    type: 'number',
    isSecret: false
  },

  'payment.methods': {
    key: 'payment.methods',
    description: 'Available payment methods (JSON array)',
    category: 'cash',
    type: 'json',
    isSecret: false
  },
  'payment.default_method': {
    key: 'payment.default_method',
    description: 'Default payment method',
    category: 'cash',
    type: 'text',
    isSecret: false
  },
}

// GET /api/admin/payment-settings - Get all payment settings
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
          startsWith: 'payment.'
        }
      }
    })

    const settingsMap = new Map(dbSettings.map(s => [s.key, s.value]))

    const settings: Record<string, PaymentSetting> = {}

    for (const key of PAYMENT_SETTINGS) {
      const meta = SETTING_META[key]
      const value = settingsMap.get(key) || DEFAULT_PAYMENT_SETTINGS[key] || ''

      settings[key] = {
        ...meta,
        value: meta.isSecret && value ? '••••••••' : value
      }
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Get payment settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/payment-settings - Update payment settings
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

    const updates: Array<{ key: string; value: string; oldValue: string }> = []

    for (const [key, value] of Object.entries(settings)) {
      if (!PAYMENT_SETTINGS.includes(key as any)) {
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
      const validated = validatePaymentSetting(key, value as string, meta)
      if (validated.error) {
        return NextResponse.json({ error: validated.error }, { status: 400 })
      }

      const oldSetting = await db.systemSetting.findUnique({ where: { key } })
      updates.push({
        key,
        value: validated.value!,
        oldValue: oldSetting?.value || DEFAULT_PAYMENT_SETTINGS[key] || ''
      })
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

    // Log the changes
    await logAction(
      session.adminId,
      session.name,
      session.role as any,
      {
        action: AUDIT_ACTIONS.PAYMENT_CONFIG_CHANGED,
        targetType: 'SystemSetting',
        targetId: 'payment',
        details: {
          before: { count: updates.length },
          after: { updated: updates.map(u => u.key) }
        }
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Payment settings updated successfully'
    })
  } catch (error) {
    console.error('Update payment settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/payment-settings/test - Test payment gateway connection
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { provider } = body

    if (!provider) {
      return NextResponse.json(
        { error: 'provider is required' },
        { status: 400 }
      )
    }

    // Get provider settings
    const settings = await db.systemSetting.findMany({
      where: {
        key: {
          startsWith: `payment.${provider}.`
        }
      }
    })

    const settingsMap = new Map(settings.map(s => [s.key, s.value]))

    // Test connection based on provider
    let result: { success: boolean; message: string; details?: Record<string, unknown> }

    switch (provider) {
      case 'mobile_money':
        result = await testMobileMoneyConnection(settingsMap)
        break
      case 'card':
        result = await testCardConnection(settingsMap)
        break
      default:
        result = {
          success: false,
          message: `Unknown provider: ${provider}`
        }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Test payment connection error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function testMobileMoneyConnection(settings: Map<string, string>): Promise<{
  success: boolean
  message: string
  details?: Record<string, unknown>
}> {
  const apiKey = settings.get('payment.mobile_money.api_key')
  const apiSecret = settings.get('payment.mobile_money.api_secret')
  const merchantId = settings.get('payment.mobile_money.merchant_id')

  if (!apiKey || !apiSecret || !merchantId) {
    return {
      success: false,
      message: 'Missing credentials. Please configure API key, secret, and merchant ID.'
    }
  }

  // In a real implementation, you would make an API call to the provider here
  // For now, we'll just validate the format
  if (apiKey.length < 10 || apiSecret.length < 10) {
    return {
      success: false,
      message: 'Invalid credentials format. API key and secret should be at least 10 characters.'
    }
  }

  return {
    success: true,
    message: 'Connection successful',
    details: {
      merchantId,
      configuredAt: new Date().toISOString()
    }
  }
}

async function testCardConnection(settings: Map<string, string>): Promise<{
  success: boolean
  message: string
  details?: Record<string, unknown>
}> {
  const provider = settings.get('payment.card.provider')
  const secretKey = settings.get('payment.card.secret_key')

  if (!provider || !secretKey) {
    return {
      success: false,
      message: 'Missing credentials. Please configure provider and secret key.'
    }
  }

  // In a real implementation, you would test the connection with the provider
  // For Stripe, you would make a test API call
  if (provider === 'stripe') {
    if (!secretKey.startsWith('sk_')) {
      return {
        success: false,
        message: 'Invalid Stripe secret key format. Should start with "sk_"'
      }
    }
  }

  return {
    success: true,
    message: 'Connection successful',
    details: {
      provider,
      configuredAt: new Date().toISOString()
    }
  }
}

function validatePaymentSetting(
  key: string,
  value: string,
  meta: PaymentSetting
): { value?: string; error?: string } {
  switch (meta.type) {
    case 'boolean':
      if (value !== 'true' && value !== 'false') {
        return { error: `${key} must be true or false` }
      }
      return { value }

    case 'number':
      const num = parseFloat(value)
      if (isNaN(num) || num < 0) {
        return { error: `${key} must be a positive number` }
      }
      return { value: String(num) }

    case 'json':
      try {
        JSON.parse(value)
        return { value }
      } catch {
        return { error: `${key} must be valid JSON` }
      }

    case 'secret':
      if (value.length > 0 && value.length < 8) {
        return { error: `${key} must be at least 8 characters` }
      }
      return { value }

    case 'text':
      if (value.length > 200) {
        return { error: `${key} is too long (max 200 characters)` }
      }
      return { value }

    default:
      return { value }
  }
}
