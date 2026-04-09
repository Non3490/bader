import { db } from '@/lib/db'

interface ActivityLogOptions {
  userId: string
  role?: string
  action: string
  details: string | Record<string, any>
  ipAddress?: string
  resourceType?: string
  resourceId?: string
  userRole?: string
  description?: string
}

export async function logActivity(
  userIdOrOptions: string | ActivityLogOptions,
  role?: string,
  action?: string,
  details?: string | Record<string, any>,
  ipAddress?: string
) {
  try {
    let opts: ActivityLogOptions

    if (typeof userIdOrOptions === 'object') {
      // Object-based call: logActivity({ userId, action, details, ... })
      opts = userIdOrOptions
      // Normalize field names for backward compatibility
      if (opts.userRole && !opts.role) opts.role = opts.userRole
      if (opts.description && !opts.details) opts.details = opts.description
    } else {
      // Positional call: logActivity(userId, role, action, details, ipAddress)
      opts = {
        userId: userIdOrOptions,
        role: role || 'UNKNOWN',
        action: action || 'ACTION',
        details: details || '',
        ipAddress,
      }
    }

    const detailsStr = typeof opts.details === 'string'
      ? opts.details
      : JSON.stringify(opts.details)

    await db.activityLog.create({
      data: {
        userId: opts.userId,
        role: opts.role || 'UNKNOWN',
        action: opts.action,
        details: detailsStr,
        ipAddress: opts.ipAddress ?? null,
      }
    })
  } catch {
    // Non-blocking — never throw from activity logger
  }
}
