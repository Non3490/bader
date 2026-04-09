/**
 * Recent Activity Widget
 *
 * Displays the last 10 audit log entries in a compact list.
 * Auto-refreshes every 30 seconds.
 */

'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import {
  Activity,
  UserPlus,
  Package,
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react'

interface ActivityLog {
  id: string
  userName: string
  action: string
  targetType: string
  targetId: string
  details: string
  createdAt: string
}

// Action type to icon mapping
const ACTION_ICONS: Record<string, React.ReactNode> = {
  'ORDER_CREATED': <Package className="h-4 w-4 text-blue-500" />,
  'ORDER_UPDATED': <Package className="h-4 w-4 text-yellow-500" />,
  'ORDER_DELETED': <XCircle className="h-4 w-4 text-red-500" />,
  'USER_CREATED': <UserPlus className="h-4 w-4 text-green-500" />,
  'USER_UPDATED': <UserPlus className="h-4 w-4 text-yellow-500" />,
  'USER_DELETED': <XCircle className="h-4 w-4 text-red-500" />,
  'ADMIN_CREATED': <UserPlus className="h-4 w-4 text-purple-500" />,
  'ADMIN_UPDATED': <UserPlus className="h-4 w-4 text-yellow-500" />,
  'SETTINGS_UPDATED': <Settings className="h-4 w-4 text-gray-500" />,
  'BLACKLIST_AUTO_FLAGGED': <AlertTriangle className="h-4 w-4 text-orange-500" />,
  'BLACKLIST_ADDED': <AlertTriangle className="h-4 w-4 text-orange-500" />,
  'BLACKLIST_REMOVED': <CheckCircle className="h-4 w-4 text-green-500" />,
  'PRODUCT_CREATED': <Package className="h-4 w-4 text-blue-500" />,
  'PRODUCT_UPDATED': <Package className="h-4 w-4 text-yellow-500" />,
  'INVOICE_CREATED': <Activity className="h-4 w-4 text-purple-500" />,
  'INVOICE_UPDATED': <Activity className="h-4 w-4 text-yellow-500" />,
}

const DEFAULT_ICON = <Activity className="h-4 w-4 text-gray-500" />

function getActionIcon(action: string): React.ReactNode {
  return ACTION_ICONS[action] || DEFAULT_ICON
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase())
}

function formatDetails(details: string, maxLength = 50): string {
  try {
    const parsed = JSON.parse(details)
    if (parsed.deleted) {
      return `Deleted: ${parsed.deleted.trackingNumber || parsed.deleted.name || parsed.deleted.email || parsed.deleted.id}`
    }
    if (parsed.before?.status && parsed.after?.status) {
      return `Status: ${parsed.before.status} → ${parsed.after.status}`
    }
    if (parsed.trackingNumber) return `Order: ${parsed.trackingNumber}`
    if (parsed.name) return parsed.name
    if (parsed.email) return parsed.email
  } catch {
    if (details.length > maxLength) {
      return details.substring(0, maxLength) + '...'
    }
    return details
  }
  return ''
}

export function ActivityWidget() {
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchActivities = async (showRefreshLoading = false) => {
    try {
      if (showRefreshLoading) setRefreshing(true)

      const response = await fetch('/api/activity-logs?limit=10')

      if (!response.ok) {
        throw new Error('Failed to fetch activities')
      }

      const data = await response.json()
      setActivities(data.logs || [])
      setError(null)
    } catch (err) {
      console.error('Failed to fetch activities:', err)
      setError('Unable to load activities')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchActivities()

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchActivities(true)
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    fetchActivities(true)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest platform actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest platform actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest platform actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest platform actions</CardDescription>
        </div>
        <Button
          onClick={handleRefresh}
          variant="ghost"
          size="sm"
          disabled={refreshing}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        </ScrollArea>
        <div className="mt-4 pt-4 border-t">
          <Link href="/admin/activity-logs">
            <Button variant="outline" className="w-full" size="sm">
              View All Activity
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityItem({ activity }: { activity: ActivityLog }) {
  const icon = getActionIcon(activity.action)
  const formattedAction = formatAction(activity.action)
  const formattedDetails = formatDetails(activity.details)
  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), {
    addSuffix: true,
    locale: fr
  })

  return (
    <div className="flex items-start gap-3 group">
      <div className="flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {activity.userName || 'System'}
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">{formattedAction}</span>
          {formattedDetails && (
            <span className="ml-1">— {formattedDetails}</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {timeAgo}
        </p>
      </div>
    </div>
  )
}
