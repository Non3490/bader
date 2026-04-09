'use client'

import { format } from 'date-fns'
import {
  Shield,
  User,
  Package,
  Settings,
  FileText,
  Download,
  Eye,
  AlertCircle
} from 'lucide-react'
import type { AuditLog } from '@prisma/client'

interface AuditEntryProps {
  log: AuditLog & {
    impersonatingAs?: {
      id: string
      name: string
      email: string
      role: string
    } | null
  }
}

const actionIcons: Record<string, React.ReactNode> = {
  USER_CREATED: <User className="h-4 w-4 text-green-600" />,
  USER_UPDATED: <User className="h-4 w-4 text-blue-600" />,
  USER_DEACTIVATED: <User className="h-4 w-4 text-red-600" />,
  USER_PASSWORD_RESET: <Shield className="h-4 w-4 text-orange-600" />,
  ORDER_STATUS_CHANGED: <Package className="h-4 w-4 text-purple-600" />,
  SETTINGS_UPDATED: <Settings className="h-4 w-4 text-gray-600" />,
  FEATURE_FLAG_TOGGLED: <AlertCircle className="h-4 w-4 text-yellow-600" />,
  PAYMENT_CONFIG_CHANGED: <Shield className="h-4 w-4 text-green-600" />,
  NOTIFICATION_CONFIG_CHANGED: <FileText className="h-4 w-4 text-blue-600" />,
  CUSTOMER_BLOCKED: <User className="h-4 w-4 text-red-600" />,
  CUSTOMER_VIP: <User className="h-4 w-4 text-yellow-600" />,
  STOCK_ADJUSTED: <Package className="h-4 w-4 text-orange-600" />,
  DATA_EXPORTED: <Download className="h-4 w-4 text-blue-600" />,
  IMPERSONATION_STARTED: <Eye className="h-4 w-4 text-purple-600" />,
  IMPERSONATION_ENDED: <Eye className="h-4 w-4 text-gray-600" />,
  LOGIN_SUCCESS: <Shield className="h-4 w-4 text-green-600" />,
  LOGIN_FAILED: <Shield className="h-4 w-4 text-red-600" />
}

const actionLabels: Record<string, string> = {
  USER_CREATED: 'Created User',
  USER_UPDATED: 'Updated User',
  USER_DEACTIVATED: 'Deactivated User',
  USER_PASSWORD_RESET: 'Reset Password',
  ORDER_STATUS_CHANGED: 'Changed Order Status',
  SETTINGS_UPDATED: 'Updated Settings',
  FEATURE_FLAG_TOGGLED: 'Toggled Feature Flag',
  PAYMENT_CONFIG_CHANGED: 'Changed Payment Config',
  NOTIFICATION_CONFIG_CHANGED: 'Changed Notification Config',
  CUSTOMER_BLOCKED: 'Blocked Customer',
  CUSTOMER_VIP: 'Marked Customer as VIP',
  STOCK_ADJUSTED: 'Adjusted Stock',
  DATA_EXPORTED: 'Exported Data',
  IMPERSONATION_STARTED: 'Started Impersonation',
  IMPERSONATION_ENDED: 'Ended Impersonation',
  LOGIN_SUCCESS: 'Logged In',
  LOGIN_FAILED: 'Failed Login Attempt'
}

export function AuditEntry({ log }: AuditEntryProps) {
  const icon = actionIcons[log.action] || <FileText className="h-4 w-4 text-gray-600" />
  const actionLabel = actionLabels[log.action] || log.action

  let details: Record<string, unknown> | null = null
  try {
    details = log.details ? JSON.parse(log.details) : null
  } catch {
    // Invalid JSON
  }

  return (
    <div className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-shrink-0 mt-0.5">
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{actionLabel}</span>
          <span className="text-muted-foreground text-sm">by</span>
          <span className="font-medium text-sm">{log.userName}</span>
          <span className="text-muted-foreground text-xs">({log.userRole})</span>
        </div>

        <div className="text-sm text-muted-foreground mt-1">
          Target: <span className="font-medium">{log.targetType}</span>
          {log.targetId && <span className="text-xs ml-1">({log.targetId.slice(0, 8)}...)</span>}
        </div>

        {details && (details.before || details.after) && (
          <div className="mt-2 text-xs space-y-1">
            {details.before && Object.keys(details.before).length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-red-600 font-medium">Before:</span>
                <span className="text-muted-foreground">
                  {JSON.stringify(details.before, null, 2)}
                </span>
              </div>
            )}
            {details.after && Object.keys(details.after).length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-medium">After:</span>
                <span className="text-muted-foreground">
                  {JSON.stringify(details.after, null, 2)}
                </span>
              </div>
            )}
          </div>
        )}

        {log.impersonatingAs && (
          <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-950 rounded text-xs">
            <span className="font-medium text-purple-600 dark:text-purple-400">
              Impersonating: {log.impersonatingAs.name} ({log.impersonatingAs.email})
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <time dateTime={log.createdAt.toISOString()}>
            {format(log.createdAt, 'PPp')}
          </time>
          {log.ipAddress && (
            <span>IP: {log.ipAddress}</span>
          )}
        </div>
      </div>
    </div>
  )
}
