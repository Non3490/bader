import { db } from '@/lib/db'
import type { AdminRole } from './admin-auth'
import { headers } from 'next/headers'

// Audit Action Types - exact strings from task spec
export const AUDIT_ACTIONS = {
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_PASSWORD_RESET: 'USER_PASSWORD_RESET',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  FEATURE_FLAG_TOGGLED: 'FEATURE_FLAG_TOGGLED',
  PAYMENT_CONFIG_CHANGED: 'PAYMENT_CONFIG_CHANGED',
  NOTIFICATION_CONFIG_CHANGED: 'NOTIFICATION_CONFIG_CHANGED',
  CUSTOMER_BLOCKED: 'CUSTOMER_BLOCKED',
  CUSTOMER_VIP: 'CUSTOMER_VIP',
  STOCK_ADJUSTED: 'STOCK_ADJUSTED',
  DATA_EXPORTED: 'DATA_EXPORTED',
  IMPERSONATION_STARTED: 'IMPERSONATION_STARTED',
  IMPERSONATION_ENDED: 'IMPERSONATION_ENDED',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED'
} as const

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS]

interface AuditDetails {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  [key: string]: unknown
}

interface LogActionOptions {
  action: AuditAction
  targetType: string
  targetId: string
  details: AuditDetails
  ipAddress?: string
  impersonatingId?: string
}

/**
 * Log an admin action to the audit log
 *
 * @param adminId - The admin performing the action
 * @param adminName - The admin's name (denormalized for fast display)
 * @param adminRole - The admin's role at time of action
 * @param options - Additional options for the audit log
 */
export async function logAction(
  adminId: string,
  adminName: string,
  adminRole: AdminRole,
  options: LogActionOptions
): Promise<void> {
  try {
    // Get IP address from headers if not provided
    let ipAddress = options.ipAddress
    if (!ipAddress) {
      try {
        const headersList = await headers()
        ipAddress = headersList.get('x-forwarded-for') ||
                   headersList.get('x-real-ip') ||
                   headersList.get('cf-connecting-ip') ||
                   undefined
      } catch {
        // Headers might not be available in all contexts
        ipAddress = undefined
      }
    }

    // Serialize details as JSON string
    const detailsString = JSON.stringify(options.details)

    await db.auditLog.create({
      data: {
        adminId,
        userName: adminName,
        userRole: adminRole,
        action: options.action,
        targetType: options.targetType,
        targetId: options.targetId,
        details: detailsString,
        ipAddress,
        impersonatingId: options.impersonatingId
      }
    })
  } catch (error) {
    console.error('Failed to log audit action:', error)
    // Don't throw - audit logging failures shouldn't break the application
  }
}

/**
 * Log a successful admin login
 */
export async function logAdminLogin(
  adminId: string,
  adminName: string,
  adminRole: AdminRole,
  ipAddress?: string
): Promise<void> {
  await logAction(adminId, adminName, adminRole, {
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    targetType: 'Admin',
    targetId: adminId,
    details: { timestamp: new Date().toISOString() },
    ipAddress
  })

  // Update lastLoginAt
  await db.admin.update({
    where: { id: adminId },
    data: { lastLoginAt: new Date() }
  })
}

/**
 * Log a failed login attempt
 */
export async function logFailedLogin(
  email: string,
  ipAddress?: string
): Promise<void> {
  try {
    // For failed logins, we don't have an admin ID yet
    await db.auditLog.create({
      data: {
        adminId: 'system', // Placeholder for failed attempts
        userName: email,
        userRole: 'UNKNOWN',
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        targetType: 'Admin',
        targetId: email,
        details: JSON.stringify({ reason: 'Invalid credentials', timestamp: new Date().toISOString() }),
        ipAddress
      }
    })
  } catch (error) {
    console.error('Failed to log failed login:', error)
  }
}

/**
 * Log order status change
 */
export async function logOrderStatusChange(
  adminId: string,
  adminName: string,
  adminRole: AdminRole,
  orderId: string,
  fromStatus: string,
  toStatus: string,
  impersonatingId?: string
): Promise<void> {
  await logAction(adminId, adminName, adminRole, {
    action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
    targetType: 'Order',
    targetId: orderId,
    details: {
      before: { status: fromStatus },
      after: { status: toStatus }
    },
    impersonatingId
  })
}

/**
 * Log settings update
 */
export async function logSettingsUpdate(
  adminId: string,
  adminName: string,
  adminRole: AdminRole,
  settingKey: string,
  fromValue: unknown,
  toValue: unknown,
  impersonatingId?: string
): Promise<void> {
  await logAction(adminId, adminName, adminRole, {
    action: AUDIT_ACTIONS.SETTINGS_UPDATED,
    targetType: 'SystemSetting',
    targetId: settingKey,
    details: {
      before: { value: fromValue },
      after: { value: toValue }
    },
    impersonatingId
  })
}

/**
 * Log impersonation start
 */
export async function logImpersonationStart(
  adminId: string,
  adminName: string,
  adminRole: AdminRole,
  targetUserId: string,
  targetUserName: string
): Promise<void> {
  await logAction(adminId, adminName, adminRole, {
    action: AUDIT_ACTIONS.IMPERSONATION_STARTED,
    targetType: 'User',
    targetId: targetUserId,
    details: {
      targetUserName,
      timestamp: new Date().toISOString()
    }
  })
}

/**
 * Log impersonation end
 */
export async function logImpersonationEnd(
  adminId: string,
  adminName: string,
  adminRole: AdminRole,
  targetUserId: string
): Promise<void> {
  await logAction(adminId, adminName, adminRole, {
    action: AUDIT_ACTIONS.IMPERSONATION_ENDED,
    targetType: 'User',
    targetId: targetUserId,
    details: {
      timestamp: new Date().toISOString()
    },
    impersonatingId: targetUserId
  })
}

/**
 * Get audit logs for a specific admin
 */
export async function getAdminAuditLogs(
  adminId: string,
  limit = 100
): Promise<typeof db.auditLog.findMany> {
  return db.auditLog.findMany({
    where: { adminId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      impersonatingAs: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    }
  })
}

/**
 * Get all audit logs with filters
 */
export async function getAuditLogs(params: {
  action?: AuditAction
  targetType?: string
  targetId?: string
  adminId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}) {
  const where: Record<string, unknown> = {}

  if (params.action) {
    where.action = params.action
  }
  if (params.targetType) {
    where.targetType = params.targetType
  }
  if (params.targetId) {
    where.targetId = params.targetId
  }
  if (params.adminId) {
    where.adminId = params.adminId
  }
  if (params.startDate || params.endDate) {
    where.createdAt = {}
    if (params.startDate) {
      (where.createdAt as Record<string, unknown>).gte = params.startDate
    }
    if (params.endDate) {
      (where.createdAt as Record<string, unknown>).lte = params.endDate
    }
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit || 50,
      skip: params.offset || 0,
      include: {
        impersonatingAs: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    }),
    db.auditLog.count({ where })
  ])

  return { logs, total }
}

export type { LogActionOptions, AuditDetails }
