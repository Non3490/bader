'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Bell,
  Clock,
  Phone,
  Check,
  AlertTriangle,
  Loader2,
  X,
  Calendar,
} from 'lucide-react'

interface Callback {
  id: string
  customerPhone: string
  callType: string
  notes: string | null
  callbackAt: string
  order?: {
    id: string
    trackingNumber: string
    customerName: string
    status: string
  } | null
}

interface CallbackRemindersProps {
  className?: string
}

const callTypeLabels: Record<string, string> = {
  ORDER: 'Order Related',
  INQUIRY: 'Inquiry',
  COMPLAINT: 'Complaint',
  FOLLOWUP: 'Follow Up',
  OTHER: 'Other',
}

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const isTomorrow = new Date(now.setDate(now.getDate() + 1)).toDateString() === date.toDateString()

  const timeStr = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })

  if (isToday) {
    return `Today at ${timeStr}`
  } else if (isTomorrow) {
    return `Tomorrow at ${timeStr}`
  } else {
    return `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at ${timeStr}`
  }
}

function isOverdue(callbackAt: string): boolean {
  return new Date(callbackAt) < new Date()
}

export function CallbackReminders({ className }: CallbackRemindersProps) {
  const [overdueCallbacks, setOverdueCallbacks] = useState<Callback[]>([])
  const [upcomingCallbacks, setUpcomingCallbacks] = useState<Callback[]>([])
  const [loading, setLoading] = useState(true)
  const [completingId, setCompletingId] = useState<string | null>(null)

  const fetchCallbacks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/phone-calls/callbacks')
      if (res.ok) {
        const data = await res.json()
        setOverdueCallbacks(data.overdue || [])
        setUpcomingCallbacks(data.upcoming || [])
      }
    } catch (error) {
      console.error('Failed to fetch callbacks:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCallbacks()
    // Refresh every minute
    const interval = setInterval(fetchCallbacks, 60000)
    return () => clearInterval(interval)
  }, [fetchCallbacks])

  const markAsComplete = async (callbackId: string) => {
    setCompletingId(callbackId)
    try {
      const res = await fetch(`/api/phone-calls/callbacks/${callbackId}/complete`, {
        method: 'POST'
      })

      if (res.ok) {
        toast.success('Callback marked as complete')
        fetchCallbacks()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to mark callback as complete')
      }
    } catch (error) {
      console.error('Complete callback error:', error)
      toast.error('Failed to mark callback as complete')
    } finally {
      setCompletingId(null)
    }
  }

  const totalPending = overdueCallbacks.length + upcomingCallbacks.length

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Callback Reminders
          </div>
          {totalPending > 0 && (
            <Badge variant={overdueCallbacks.length > 0 ? 'destructive' : 'secondary'}>
              {totalPending} pending
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalPending === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No pending callbacks</p>
          </div>
        ) : (
          <ScrollArea className="h-80">
            <div className="space-y-4 pr-4">
              {/* Overdue Callbacks */}
              {overdueCallbacks.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Overdue ({overdueCallbacks.length})
                  </div>
                  {overdueCallbacks.map(callback => (
                    <CallbackCard
                      key={callback.id}
                      callback={callback}
                      overdue
                      completing={completingId === callback.id}
                      onComplete={() => markAsComplete(callback.id)}
                    />
                  ))}
                </div>
              )}

              {/* Upcoming Callbacks */}
              {upcomingCallbacks.length > 0 && (
                <div className="space-y-3">
                  {overdueCallbacks.length > 0 && (
                    <div className="flex items-center gap-2 text-sm font-medium pt-2 border-t">
                      <Clock className="h-4 w-4" />
                      Upcoming ({upcomingCallbacks.length})
                    </div>
                  )}
                  {upcomingCallbacks.map(callback => (
                    <CallbackCard
                      key={callback.id}
                      callback={callback}
                      overdue={false}
                      completing={completingId === callback.id}
                      onComplete={() => markAsComplete(callback.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

interface CallbackCardProps {
  callback: Callback
  overdue: boolean
  completing: boolean
  onComplete: () => void
}

function CallbackCard({ callback, overdue, completing, onComplete }: CallbackCardProps) {
  return (
    <div className={cn(
      'p-3 border rounded-lg space-y-2',
      overdue && 'border-destructive/50 bg-destructive/5'
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <Phone className={cn(
              'h-4 w-4',
              overdue ? 'text-destructive' : 'text-muted-foreground'
            )} />
            <span className="font-medium">{callback.customerPhone}</span>
            {overdue && (
              <Badge variant="destructive" className="text-xs">
                Overdue
              </Badge>
            )}
          </div>

          {callback.order && (
            <div className="text-sm text-muted-foreground">
              Order: {callback.order.trackingNumber} • {callback.order.customerName}
            </div>
          )}

          <div className={cn(
            'text-xs flex items-center gap-1',
            overdue ? 'text-destructive' : 'text-muted-foreground'
          )}>
            <Calendar className="h-3 w-3" />
            {formatDateTime(callback.callbackAt)}
          </div>

          {callback.notes && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {callback.notes}
            </p>
          )}

          <Badge variant="outline" className="text-xs">
            {callTypeLabels[callback.callType] || callback.callType}
          </Badge>
        </div>

        <Button
          size="sm"
          onClick={onComplete}
          disabled={completing}
          variant={overdue ? 'default' : 'outline'}
        >
          {completing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Check className="h-4 w-4 mr-1" />
              Complete
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
