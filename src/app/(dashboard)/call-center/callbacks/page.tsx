'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Phone,
  Check,
  Calendar,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Callback {
  id: string
  customerPhone: string
  customerId?: string
  callType: string
  notes?: string | null
  callbackAt: string
  callbackDone: boolean
  completedAt?: string | null
  orderId?: string
  order?: {
    id: string
    trackingNumber: string
    customerName: string
    status: string
  } | null
  durationMinutes?: number | null
}

const CALL_TYPE_LABELS: Record<string, string> = {
  ORDER: 'Commande',
  INQUIRY: 'Demande d\'information',
  COMPLAINT: 'Réclamation',
  FOLLOWUP: 'Suivi',
  OTHER: 'Autre'
}

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  const timeStr = format(date, 'HH:mm', { locale: fr })

  if (isToday) {
    return `Aujourd'hui à ${timeStr}`
  } else if (isTomorrow) {
    return `Demain à ${timeStr}`
  } else {
    return format(date, 'd MMM à HH:mm', { locale: fr })
  }
}

function isOverdue(callbackAt: string): boolean {
  return new Date(callbackAt) < new Date()
}

export default function CallCenterCallbacksPage() {
  const router = useRouter()
  const [pendingCallbacks, setPendingCallbacks] = useState<Callback[]>([])
  const [completedCallbacks, setCompletedCallbacks] = useState<Callback[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [completingId, setCompletingId] = useState<string | null>(null)

  const fetchCallbacks = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const res = await fetch('/api/phone-calls/callbacks')
      if (!res.ok) {
        throw new Error('Failed to fetch callbacks')
      }

      const data = await res.json()

      // Separate pending and completed callbacks
      const allPending = [...(data.overdue || []), ...(data.upcoming || [])]
      setPendingCallbacks(allPending)

      // For now, we don't have completed callbacks in the API response
      // This could be fetched from a separate endpoint or filter
      setCompletedCallbacks([])
    } catch (error) {
      console.error('Failed to fetch callbacks:', error)
      toast.error('Impossible de charger les rappels')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchCallbacks()
    // Refresh every minute
    const interval = setInterval(() => fetchCallbacks(), 60000)
    return () => clearInterval(interval)
  }, [fetchCallbacks])

  const handleCall = (phone: string, orderId?: string, orderTracking?: string) => {
    // Navigate to phone order page with customer pre-loaded
    if (orderId) {
      router.push(`/orders/${orderId}`)
    } else {
      // Navigate to phone orders page with phone pre-filled
      router.push(`/phone-orders?phone=${phone}`)
    }
  }

  const markAsDone = async (callbackId: string) => {
    setCompletingId(callbackId)

    try {
      const res = await fetch(`/api/phone-calls/callbacks/${callbackId}/complete`, {
        method: 'POST'
      })

      if (!res.ok) {
        throw new Error('Failed to mark callback as complete')
      }

      toast.success('Rappel marqué comme terminé')
      fetchCallbacks()
    } catch (error) {
      console.error('Failed to mark callback as complete:', error)
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setCompletingId(null)
    }
  }

  const CallbackCard = ({ callback, completed = false }: { callback: Callback; completed?: boolean }) => {
    const overdue = !completed && isOverdue(callback.callbackAt)

    return (
      <Card className={cn(
        'transition-all hover:shadow-md',
        overdue && 'border-red-300 bg-red-50/50'
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              {/* Header */}
              <div className="flex items-center gap-2">
                <Phone className={cn(
                  'h-4 w-4',
                  overdue ? 'text-red-600' : 'text-muted-foreground'
                )} />
                <span className="font-medium">{callback.customerPhone}</span>
                {overdue && (
                  <Badge variant="destructive" className="text-xs">
                    En retard
                  </Badge>
                )}
                {completed && (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                    Terminé
                  </Badge>
                )}
              </div>

              {/* Order info */}
              {callback.order && (
                <div className="text-sm text-muted-foreground">
                  Commande: {callback.order.trackingNumber} • {callback.order.customerName}
                </div>
              )}

              {/* Scheduled time */}
              <div className={cn(
                'text-xs flex items-center gap-1',
                overdue ? 'text-red-600' : 'text-muted-foreground'
              )}>
                <Calendar className="h-3 w-3" />
                {completed && callback.completedAt
                  ? `Terminé ${formatDistanceToNow(new Date(callback.completedAt), { addSuffix: true, locale: fr })}`
                  : formatDateTime(callback.callbackAt)
                }
              </div>

              {/* Notes */}
              {callback.notes && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {callback.notes}
                </p>
              )}

              {/* Call type badge */}
              <Badge variant="outline" className="text-xs">
                {CALL_TYPE_LABELS[callback.callType] || callback.callType}
              </Badge>

              {/* Duration for completed callbacks */}
              {completed && callback.durationMinutes && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {callback.durationMinutes} min
                </div>
              )}
            </div>

            {/* Actions */}
            {!completed && (
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  onClick={() => handleCall(
                    callback.customerPhone,
                    callback.orderId || undefined,
                    callback.order?.trackingNumber
                  )}
                  className="bg-[#f07020] hover:bg-[#d96000]"
                >
                  <Phone className="h-4 w-4 mr-1" />
                  Appeler
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markAsDone(callback.id)}
                  disabled={completingId === callback.id}
                >
                  {completingId === callback.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Marquer fait
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Rappels Programmés</h1>
            <p className="text-muted-foreground">Gérez vos rappels clients</p>
          </div>
          <Skeleton className="h-10 w-10" />
        </div>

        <Skeleton className="h-12 w-64" />

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  // Count overdue callbacks
  const overdueCount = pendingCallbacks.filter(cb => isOverdue(cb.callbackAt)).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rappels Programmés</h1>
          <p className="text-muted-foreground">Gérez vos rappels clients</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchCallbacks(true)}
          disabled={refreshing}
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Overdue warning banner */}
      {overdueCount > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div className="flex-1">
              <p className="font-medium text-red-900">
                {overdueCount} rappel{overdueCount > 1 ? 's' : ''} en retard
              </p>
              <p className="text-sm text-red-700">
                Ces rappels auraient dû être effectués. Veuillez les traiter prioritairement.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            En attente
            {pendingCallbacks.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingCallbacks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            Terminés
            {completedCallbacks.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {completedCallbacks.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {pendingCallbacks.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Check className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun rappel en attente</p>
              </CardContent>
            </Card>
          ) : (
            // Sort by scheduled time (overdue first, then upcoming)
            [...pendingCallbacks]
              .sort((a, b) => new Date(a.callbackAt).getTime() - new Date(b.callbackAt).getTime())
              .map((callback) => (
                <CallbackCard key={callback.id} callback={callback} />
              ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 mt-4">
          {completedCallbacks.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun rappel terminé</p>
              </CardContent>
            </Card>
          ) : (
            completedCallbacks.map((callback) => (
              <CallbackCard key={callback.id} callback={callback} completed />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
