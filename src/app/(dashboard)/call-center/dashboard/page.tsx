'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CallbackReminders } from '@/components/call-center/CallbackReminders'
import { useUser } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Phone,
  Package,
  Clock,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Users,
  TrendingUp,
} from 'lucide-react'

interface DashboardStats {
  activePhoneOrders: number
  pendingPhoneOrders: number
  todayCalls: number
  pendingCallbacks: number
  overdueCallbacks: number
}

interface ActiveOrder {
  id: string
  trackingNumber: string
  recipientName: string
  phone: string
  address: string
  city: string
  codAmount: number
  status: string
  createdAt: string
  itemCount: number
  itemNames: string
}

interface Agent {
  id: string
  name: string
  email: string
  phone?: string
  pendingOrders: number
  isOnline: boolean
  currentWorkload: number
}

const statusConfig: Record<string, { label: string; color: string }> = {
  NEW: { label: 'New', color: 'bg-blue-100 text-blue-700' },
  CONFIRMED: { label: 'Confirmed', color: 'bg-green-100 text-green-700' },
  SHIPPED: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-700' },
  DELIVERED: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700' },
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('fr-GA', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(value)
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function CallCenterDashboardPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsRes, agentsRes] = await Promise.all([
        fetch('/api/call-center/dashboard'),
        fetch('/api/call-center/agents')
      ])

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data.stats)
        setActiveOrders(data.activeOrders || [])
      }

      if (agentsRes.ok) {
        const data = await agentsRes.json()
        setAgents(data.agents || [])
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchDashboardData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchDashboardData()
  }

  // Reassign order to agent
  const reassignOrder = async (orderId: string, agentId: string) => {
    try {
      const res = await fetch('/api/call-center/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, agentId })
      })

      if (res.ok) {
        toast.success('Order reassigned successfully')
        fetchDashboardData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to reassign order')
      }
    } catch (error) {
      console.error('Reassign order error:', error)
      toast.error('Failed to reassign order')
    }
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
          <div>
            <h1 className="text-2xl font-bold">Call Center Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Monitor phone orders and agent activity
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Refresh
            </Button>
            <Button onClick={() => router.push('/phone-orders')}>
              <Phone className="h-4 w-4 mr-2" />
              New Phone Order
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Active Phone Orders</p>
                    <p className="text-2xl font-bold">{stats.activePhoneOrders}</p>
                  </div>
                  <Phone className="h-8 w-8 text-blue-500 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold">{stats.pendingPhoneOrders}</p>
                  </div>
                  <Package className="h-8 w-8 text-amber-500 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Today's Calls</p>
                    <p className="text-2xl font-bold">{stats.todayCalls}</p>
                  </div>
                  <Phone className="h-8 w-8 text-green-500 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Callbacks</p>
                    <p className="text-2xl font-bold">{stats.pendingCallbacks}</p>
                  </div>
                  <Clock className="h-8 w-8 text-purple-500 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className={stats.overdueCallbacks > 0 ? 'border-red-200 bg-red-50/50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                    <p className="text-2xl font-bold text-red-600">{stats.overdueCallbacks}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500 opacity-20" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Phone Orders */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Active Phone Orders (Last 2 Hours)
                  <Badge variant="secondary">{activeOrders.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No active phone orders</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeOrders.map(order => {
                      const statusInfo = statusConfig[order.status] || statusConfig.NEW
                      return (
                        <div
                          key={order.id}
                          className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{order.trackingNumber}</span>
                                <Badge className={statusInfo.color}>
                                  {statusInfo.label}
                                </Badge>
                              </div>
                              <div className="text-sm">
                                <p className="font-medium">{order.recipientName}</p>
                                <p className="text-muted-foreground">{order.phone}</p>
                                <p className="text-muted-foreground">{order.city}</p>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {order.itemNames}
                              </div>
                              <div className="flex items-center gap-3 text-sm">
                                <span className="font-medium">{formatMoney(order.codAmount)}</span>
                                <span>•</span>
                                <span>{formatTime(order.createdAt)}</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/orders/${order.id}`)}
                              >
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Agents List */}
            {user.role === 'ADMIN' || role === 'SUPER_ADMIN' && agents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Agent Workload
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {agents.map(agent => (
                      <div
                        key={agent.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{agent.name}</span>
                            {agent.isOnline ? (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                Online
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Offline
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {agent.pendingOrders} pending orders • {agent.currentWorkload} workload
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-sm font-medium',
                            agent.pendingOrders > 5 ? 'text-amber-600' : 'text-muted-foreground'
                          )}>
                            {agent.pendingOrders}
                          </span>
                          <span className="text-xs text-muted-foreground">orders</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Callback Reminders */}
            <CallbackReminders />

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/phone-orders')}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  New Phone Order
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/call-center/call-history')}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  View Call History
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/orders')}
                >
                  <Package className="h-4 w-4 mr-2" />
                  All Orders
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </CardContent>
            </Card>

            {/* Performance Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Today's Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Calls Made</span>
                      <span className="font-medium">{stats.todayCalls}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pending Callbacks</span>
                      <span className="font-medium">{stats.pendingCallbacks}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Overdue Callbacks</span>
                      <span className={cn(
                        'font-medium',
                        stats.overdueCallbacks > 0 ? 'text-red-600' : ''
                      )}>
                        {stats.overdueCallbacks}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
