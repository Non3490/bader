'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Loader2,
  ArrowLeft,
  Search,
  Filter,
  Download,
} from 'lucide-react'

interface CallLogEntry {
  id: string
  customerPhone: string
  direction: string
  callType: string
  notes: string | null
  durationMinutes: number | null
  callbackNeeded: boolean
  callbackAt: string | null
  callbackDone: boolean
  createdAt: string
  agent?: {
    id: string
    name: string
  }
  order?: {
    id: string
    trackingNumber: string
    status: string
  } | null
}

const directionConfig = {
  INCOMING: { label: 'Incoming', icon: PhoneIncoming, color: 'text-green-600 bg-green-50' },
  OUTGOING: { label: 'Outgoing', icon: PhoneOutgoing, color: 'text-blue-600 bg-blue-50' },
}

const callTypeLabels: Record<string, string> = {
  ORDER: 'Order Related',
  INQUIRY: 'Inquiry',
  COMPLAINT: 'Complaint',
  FOLLOWUP: 'Follow Up',
  OTHER: 'Other',
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function CallHistoryPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchPhone, setSearchPhone] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | 'INCOMING' | 'OUTGOING'>('ALL')

  const fetchCallLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchPhone) params.append('phone', searchPhone)

      const res = await fetch(`/api/phone-calls?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        let logs = data.calls || []

        // Filter by direction if specified
        if (filterType !== 'ALL') {
          logs = logs.filter((log: CallLogEntry) => log.direction === filterType)
        }

        setCallLogs(logs)
      }
    } catch (error) {
      console.error('Failed to fetch call logs:', error)
    } finally {
      setLoading(false)
    }
  }, [searchPhone, filterType])

  useEffect(() => {
    fetchCallLogs()
  }, [fetchCallLogs])

  const handleExport = () => {
    // Simple CSV export
    const headers = ['Date', 'Direction', 'Type', 'Phone', 'Duration (min)', 'Notes', 'Callback']
    const rows = callLogs.map(log => [
      formatTime(log.createdAt),
      log.direction,
      callTypeLabels[log.callType] || log.callType,
      log.customerPhone,
      log.durationMinutes || '',
      log.notes || '',
      log.callbackNeeded ? (log.callbackDone ? 'Done' : `Pending: ${log.callbackAt ? formatTime(log.callbackAt) : 'N/A'}`) : 'No'
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `call-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (userLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">You don't have access to this page.</p>
          <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Call History</h1>
              <p className="text-sm text-muted-foreground">
                View and search phone call logs
              </p>
            </div>
          </div>
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by phone number..."
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Calls</SelectItem>
                  <SelectItem value="INCOMING">Incoming Only</SelectItem>
                  <SelectItem value="OUTGOING">Outgoing Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Call Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Call Logs</span>
              <Badge variant="secondary">{callLogs.length} records</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {callLogs.length === 0 ? (
              <div className="text-center py-12">
                <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {searchPhone ? 'No calls found for this phone number' : 'No call logs yet today'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-2 pr-4">
                  {callLogs.map(log => {
                    const config = directionConfig[log.direction as keyof typeof directionConfig]
                    const DirectionIcon = config?.icon
                    return (
                      <div
                        key={log.id}
                        className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{log.customerPhone}</span>
                              {DirectionIcon && (
                                <Badge className={cn('text-xs', config?.color)}>
                                  <DirectionIcon className="h-3 w-3 mr-1" />
                                  {config?.label}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {callTypeLabels[log.callType] || log.callType}
                              </Badge>
                              {log.callbackNeeded && !log.callbackDone && (
                                <Badge variant="destructive" className="text-xs">
                                  Callback Pending
                                </Badge>
                              )}
                            </div>

                            <div className="text-sm text-muted-foreground">
                              <p>Agent: {log.agent?.name || 'Unknown'}</p>
                              <p>Time: {formatTime(log.createdAt)}</p>
                              {log.durationMinutes && (
                                <p>Duration: {log.durationMinutes} min</p>
                              )}
                            </div>

                            {log.notes && (
                              <p className="text-sm">{log.notes}</p>
                            )}

                            {log.order && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Order:</span>
                                <span className="font-medium">{log.order.trackingNumber}</span>
                                <Badge variant="outline" className="text-xs">
                                  {log.order.status}
                                </Badge>
                              </div>
                            )}

                            {log.callbackAt && !log.callbackDone && (
                              <p className="text-xs text-amber-600">
                                Callback scheduled: {formatTime(log.callbackAt)}
                              </p>
                            )}
                          </div>

                          {log.order && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/orders/${log.order.id}`)}
                            >
                              View Order
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
