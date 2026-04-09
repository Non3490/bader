import { db } from '@/lib/db'

// Feature flag definitions
export const FEATURE_FLAGS = {
  // Core modules
  POS_MODULE: 'feature.pos',
  CALL_CENTER_MODULE: 'feature.call_center',
  DELIVERY_MODULE: 'feature.delivery',
  STOCK_MODULE: 'feature.stock',
  FINANCE_MODULE: 'feature.finance',
  ANALYTICS_MODULE: 'feature.analytics',

  // System-wide settings
  MAINTENANCE_MODE: 'system.maintenance_mode',
  REGISTRATION_ENABLED: 'system.registration_enabled',
  API_RATE_LIMITING: 'system.api_rate_limiting',
  API_RATE_LIMIT_REQUESTS: 'system.api_rate_limit_requests',
  API_RATE_LIMIT_WINDOW: 'system.api_rate_limit_window',

  // Payment features
  PAYMENT_ONLINE: 'payment.online_enabled',
  PAYMENT_CASH: 'payment.cash_enabled',
  PAYMENT_WALLET: 'payment.wallet_enabled',

  // Notification features
  NOTIFICATION_SMS: 'notification.sms_enabled',
  NOTIFICATION_EMAIL: 'notification.email_enabled',
  NOTIFICATION_WHATSAPP: 'notification.whatsapp_enabled',
} as const

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS

// Default values for feature flags
const DEFAULT_FLAGS: Record<string, string | boolean> = {
  [FEATURE_FLAGS.POS_MODULE]: 'true',
  [FEATURE_FLAGS.CALL_CENTER_MODULE]: 'true',
  [FEATURE_FLAGS.DELIVERY_MODULE]: 'true',
  [FEATURE_FLAGS.STOCK_MODULE]: 'true',
  [FEATURE_FLAGS.FINANCE_MODULE]: 'true',
  [FEATURE_FLAGS.ANALYTICS_MODULE]: 'true',
  [FEATURE_FLAGS.MAINTENANCE_MODE]: 'false',
  [FEATURE_FLAGS.REGISTRATION_ENABLED]: 'true',
  [FEATURE_FLAGS.API_RATE_LIMITING]: 'true',
  [FEATURE_FLAGS.API_RATE_LIMIT_REQUESTS]: '100',
  [FEATURE_FLAGS.API_RATE_LIMIT_WINDOW]: '60', // seconds
  [FEATURE_FLAGS.PAYMENT_ONLINE]: 'true',
  [FEATURE_FLAGS.PAYMENT_CASH]: 'true',
  [FEATURE_FLAGS.PAYMENT_WALLET]: 'true',
  [FEATURE_FLAGS.NOTIFICATION_SMS]: 'false',
  [FEATURE_FLAGS.NOTIFICATION_EMAIL]: 'true',
  [FEATURE_FLAGS.NOTIFICATION_WHATSAPP]: 'false',
}

// Feature flag descriptions for the UI
export const FLAG_DESCRIPTIONS: Record<string, string> = {
  [FEATURE_FLAGS.POS_MODULE]: 'Enable Point of Sale module for sellers',
  [FEATURE_FLAGS.CALL_CENTER_MODULE]: 'Enable Call Center operations',
  [FEATURE_FLAGS.DELIVERY_MODULE]: 'Enable Delivery management',
  [FEATURE_FLAGS.STOCK_MODULE]: 'Enable Stock and Inventory management',
  [FEATURE_FLAGS.FINANCE_MODULE]: 'Enable Finance and Invoicing',
  [FEATURE_FLAGS.ANALYTICS_MODULE]: 'Enable Analytics and Reports',
  [FEATURE_FLAGS.MAINTENANCE_MODE]: 'Put the platform in maintenance mode (only admins can access)',
  [FEATURE_FLAGS.REGISTRATION_ENABLED]: 'Allow new user registrations',
  [FEATURE_FLAGS.API_RATE_LIMITING]: 'Enable API rate limiting',
  [FEATURE_FLAGS.API_RATE_LIMIT_REQUESTS]: 'Max requests per rate limit window',
  [FEATURE_FLAGS.API_RATE_LIMIT_WINDOW]: 'Rate limit window in seconds',
  [FEATURE_FLAGS.PAYMENT_ONLINE]: 'Enable online payment methods',
  [FEATURE_FLAGS.PAYMENT_CASH]: 'Enable cash on delivery',
  [FEATURE_FLAGS.PAYMENT_WALLET]: 'Enable wallet payments',
  [FEATURE_FLAGS.NOTIFICATION_SMS]: 'Enable SMS notifications',
  [FEATURE_FLAGS.NOTIFICATION_EMAIL]: 'Enable email notifications',
  [FEATURE_FLAGS.NOTIFICATION_WHATSAPP]: 'Enable WhatsApp notifications',
}

// Feature flag categories
export const FLAG_CATEGORIES = {
  MODULES: 'Modules',
  SYSTEM: 'System',
  PAYMENT: 'Payment',
  NOTIFICATION: 'Notification',
} as const

export const FLAG_CATEGORY_MAP: Record<string, string> = {
  [FEATURE_FLAGS.POS_MODULE]: FLAG_CATEGORIES.MODULES,
  [FEATURE_FLAGS.CALL_CENTER_MODULE]: FLAG_CATEGORIES.MODULES,
  [FEATURE_FLAGS.DELIVERY_MODULE]: FLAG_CATEGORIES.MODULES,
  [FEATURE_FLAGS.STOCK_MODULE]: FLAG_CATEGORIES.MODULES,
  [FEATURE_FLAGS.FINANCE_MODULE]: FLAG_CATEGORIES.MODULES,
  [FEATURE_FLAGS.ANALYTICS_MODULE]: FLAG_CATEGORIES.MODULES,
  [FEATURE_FLAGS.MAINTENANCE_MODE]: FLAG_CATEGORIES.SYSTEM,
  [FEATURE_FLAGS.REGISTRATION_ENABLED]: FLAG_CATEGORIES.SYSTEM,
  [FEATURE_FLAGS.API_RATE_LIMITING]: FLAG_CATEGORIES.SYSTEM,
  [FEATURE_FLAGS.API_RATE_LIMIT_REQUESTS]: FLAG_CATEGORIES.SYSTEM,
  [FEATURE_FLAGS.API_RATE_LIMIT_WINDOW]: FLAG_CATEGORIES.SYSTEM,
  [FEATURE_FLAGS.PAYMENT_ONLINE]: FLAG_CATEGORIES.PAYMENT,
  [FEATURE_FLAGS.PAYMENT_CASH]: FLAG_CATEGORIES.PAYMENT,
  [FEATURE_FLAGS.PAYMENT_WALLET]: FLAG_CATEGORIES.PAYMENT,
  [FEATURE_FLAGS.NOTIFICATION_SMS]: FLAG_CATEGORIES.NOTIFICATION,
  [FEATURE_FLAGS.NOTIFICATION_EMAIL]: FLAG_CATEGORIES.NOTIFICATION,
  [FEATURE_FLAGS.NOTIFICATION_WHATSAPP]: FLAG_CATEGORIES.NOTIFICATION,
}

/**
 * Get a feature flag value
 */
export async function getFeatureFlag(key: string): Promise<string | null> {
  const setting = await db.systemSetting.findUnique({
    where: { key }
  })

  return setting?.value || null
}

/**
 * Get a boolean feature flag value
 */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const value = await getFeatureFlag(key)
  if (value === null) {
    const defaultValue = DEFAULT_FLAGS[key]
    return typeof defaultValue === 'boolean' ? defaultValue : defaultValue === 'true'
  }
  return value === 'true'
}

/**
 * Get all feature flags
 */
export async function getAllFeatureFlags(): Promise<Record<string, string>> {
  const settings = await db.systemSetting.findMany({
    where: {
      key: {
        startsWith: 'feature.'
      }
    }
  })

  const flags: Record<string, string> = { ...DEFAULT_FLAGS }

  for (const setting of settings) {
    flags[setting.key] = setting.value
  }

  return flags
}

/**
 * Get all system settings (including feature flags)
 */
export async function getAllSystemSettings(): Promise<Array<{
  key: string
  value: string
  description: string | null
  category: string
}>> {
  const settings = await db.systemSetting.findMany({
    orderBy: { key: 'asc' }
  })

  const settingsMap = new Map(settings.map(s => [s.key, s]))

  const allSettings: Array<{
    key: string
    value: string
    description: string | null
    category: string
  }> = []

  // Add all defined feature flags and system settings
  for (const [key, defaultValue] of Object.entries(DEFAULT_FLAGS)) {
    const setting = settingsMap.get(key)
    const category = FLAG_CATEGORY_MAP[key] || 'Other'

    allSettings.push({
      key,
      value: setting?.value || String(defaultValue),
      description: FLAG_DESCRIPTIONS[key] || setting?.description || null,
      category
    })

    settingsMap.delete(key)
  }

  // Add any other settings in the database
  for (const [key, setting] of settingsMap) {
    allSettings.push({
      key: setting.key,
      value: setting.value,
      description: setting.description,
      category: 'Other'
    })
  }

  return allSettings
}

/**
 * Set a feature flag value
 */
export async function setFeatureFlag(
  key: string,
  value: string,
  adminId: string,
  adminName: string,
  adminRole: string
): Promise<void> {
  const existing = await db.systemSetting.findUnique({
    where: { key }
  })

  const oldValue = existing?.value || DEFAULT_FLAGS[key] || ''

  await db.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value,
      description: FLAG_DESCRIPTIONS[key]
    },
    update: {
      value
    }
  })

  // Log the change
  const { logAction } = await import('./audit-logger')
  await logAction(adminId, adminName, adminRole as any, {
    action: 'FEATURE_FLAG_TOGGLED',
    targetType: 'SystemSetting',
    targetId: key,
    details: {
      before: { value: oldValue },
      after: { value }
    }
  })
}

/**
 * Set multiple feature flags at once
 */
export async function setFeatureFlags(
  flags: Record<string, string>,
  adminId: string,
  adminName: string,
  adminRole: string
): Promise<void> {
  for (const [key, value] of Object.entries(flags)) {
    await setFeatureFlag(key, value, adminId, adminName, adminRole)
  }
}

/**
 * Check if maintenance mode is enabled
 */
export async function isMaintenanceMode(): Promise<boolean> {
  return isFeatureEnabled(FEATURE_FLAGS.MAINTENANCE_MODE)
}

/**
 * Get API rate limit settings
 */
export async function getRateLimitSettings(): Promise<{
  enabled: boolean
  requests: number
  window: number
}> {
  const [enabled, requests, window] = await Promise.all([
    isFeatureEnabled(FEATURE_FLAGS.API_RATE_LIMITING),
    getFeatureFlag(FEATURE_FLAGS.API_RATE_LIMIT_REQUESTS),
    getFeatureFlag(FEATURE_FLAGS.API_RATE_LIMIT_WINDOW),
  ])

  return {
    enabled,
    requests: parseInt(requests || '100'),
    window: parseInt(window || '60'),
  }
}
