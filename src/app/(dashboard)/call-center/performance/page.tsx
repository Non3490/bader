'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUser } from '@/hooks/use-user'
import {
  Phone,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  RefreshCcw,
  User,
  Loader2,
  BarChart3
} from 'lucide-react'
import { toast } from 'sonner'

interface Agent {
  id: string
  name: string
  createdAt: string
}

interface AgentStats {
  agent: Agent
  stats: {
    totalCalls: number
    uniqueOrders: number
    confirmed: number
    cancelled: number
    noAnswer: number
    busy: number
    wrongNumber: number
    confirmationRate: string
    avgCallsPerHour: string
    callRate: string
  }
}

interface PerformanceSummary {
  totalAgents: number
  totalCalls: number
  totalConfirmed: number
  totalCancelled: number
  avgConfirmationRate: string
}

export default function CallCenterPerformancePage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [data, setData] = useState<AgentStats[]>([])
  const [summary, setSummary] = useState<PerformanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7')

  useEffect(() => {
    if (!userLoading && (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'CALL_CENTER'))) {
      router.push('/unauthorized')
    }
  }, [user, userLoading, router])

  const fetchData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch(`/api/call-center/performance?period=${period}`)
      if (res.ok) {
        const json = await res.json()
        setData(json.data || [])
        setSummary(json.summary)
      }
    } catch (error) {
      console.error('Failed to fetch performance data:', error)
      toast.error('Failed to load performance data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) fetchData()
  }, [user, period])

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user || user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return null

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />Call Center Performance
            </h1>
            <p className="text-muted-foreground text-sm">Agent performance metrics</p>
          </div>
          <div className="flex gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Agents</p>
                    <p className="text-2xl font-bold">{summary.totalAgents}</p>
                  </div>
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Calls</p>
                    <p className="text-2xl font-bold">{summary.totalCalls}</p>
                  </div>
                  <Phone className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Confirmed</p>
                    <p className="text-2xl font-bold text-green-600">{summary.totalConfirmed}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cancelled</p>
                    <p className="text-2xl font-bold text-red-600">{summary.totalCancelled}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Rate</p>
                    <p className="text-2xl font-bold">{summary.avgConfirmationRate}%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-indigo-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Performance Table */}
        <Card>
          <CardContent className="p-6">
            {data.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <p>No performance data available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-medium">Agent</th>
                      <th className="text-center p-4 font-medium">Total Calls</th>
                      <th className="text-center p-4 font-medium">Confirmed</th>
                      <th className="text-center p-4 font-medium">Cancelled</th>
                      <th className="text-center p-4 font-medium">No Answer</th>
                      <th className="text-center p-4 font-medium">Conf. Rate</th>
                      <th className="text-center p-4 font-medium">Avg/Hour</th>
                      <th className="text-center p-4 font-medium">Calls/Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr key={row.agent.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{row.agent.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Since {new Date(row.agent.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </td>
                        <td className="p-4 text-center font-medium">{row.stats.totalCalls}</td>
                        <td className="p-4 text-center text-green-600 font-medium">{row.stats.confirmed}</td>
                        <td className="p-4 text-center text-red-600 font-medium">{row.stats.cancelled}</td>
                        <td className="p-4 text-center text-orange-600">{row.stats.noAnswer}</td>
                        <td className="p-4 text-center">
                          <Badge variant={parseFloat(row.stats.confirmationRate) >= 50 ? 'default' : 'secondary'}>
                            {row.stats.confirmationRate}%
                          </Badge>
                        </td>
                        <td className="p-4 text-center">{row.stats.avgCallsPerHour}</td>
                        <td className="p-4 text-center">{row.stats.callRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
