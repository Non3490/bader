import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import {
  getAllFeatureFlags,
  getAllSystemSettings,
  setFeatureFlags,
  isMaintenanceMode,
  FLAG_CATEGORIES
} from '@/lib/feature-flags'

// GET /api/admin/feature-flags - Get all feature flags and system settings
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const { checkPermission } = await import('@/lib/admin-auth')
    const permissionCheck = checkPermission(session.role as any, '*')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const settings = await getAllSystemSettings()

    // Group by category
    const grouped: Record<string, Array<{
      key: string
      value: string
      description: string | null
      type: 'boolean' | 'number' | 'string'
    }>> = {
      [FLAG_CATEGORIES.MODULES]: [],
      [FLAG_CATEGORIES.SYSTEM]: [],
      [FLAG_CATEGORIES.PAYMENT]: [],
      [FLAG_CATEGORIES.NOTIFICATION]: [],
      Other: []
    }

    for (const setting of settings) {
      // Determine type based on value
      let type: 'boolean' | 'number' | 'string' = 'string'
      if (setting.value === 'true' || setting.value === 'false') {
        type = 'boolean'
      } else if (!isNaN(parseInt(setting.value))) {
        type = 'number'
      }

      const category = grouped[setting.category] || grouped.Other
      category.push({
        key: setting.key,
        value: setting.value,
        description: setting.description,
        type
      })
    }

    const maintenanceMode = await isMaintenanceMode()

    return NextResponse.json({
      settings: grouped,
      maintenanceMode
    })
  } catch (error) {
    console.error('Get feature flags error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/feature-flags - Update feature flags
export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admin can modify feature flags
    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only Super Admin can modify feature flags' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { flags } = body

    if (!flags || typeof flags !== 'object') {
      return NextResponse.json(
        { error: 'flags object is required' },
        { status: 400 }
      )
    }

    // Validate flags
    const { FEATURE_FLAGS } = await import('@/lib/feature-flags')
    const validKeys = Object.values(FEATURE_FLAGS)

    for (const key of Object.keys(flags)) {
      if (!validKeys.includes(key)) {
        return NextResponse.json(
          { error: `Invalid feature flag key: ${key}` },
          { status: 400 }
        )
      }

      const value = flags[key]
      // Validate boolean flags
      if (key.startsWith('feature.') && value !== 'true' && value !== 'false') {
        return NextResponse.json(
          { error: `Feature flag ${key} must be 'true' or 'false'` },
          { status: 400 }
        )
      }

      // Validate number flags
      if (key.includes('rate_limit')) {
        const num = parseInt(value)
        if (isNaN(num) || num < 0) {
          return NextResponse.json(
            { error: `Rate limit value must be a positive number` },
            { status: 400 }
          )
        }
      }
    }

    // Update flags
    await setFeatureFlags(
      flags,
      session.adminId,
      session.name,
      session.role
    )

    return NextResponse.json({
      success: true,
      message: 'Feature flags updated successfully'
    })
  } catch (error) {
    console.error('Update feature flags error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
