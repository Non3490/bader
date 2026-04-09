'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Phone,
  RefreshCw,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRightLeft,
  Inbox,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AgentStat {
  id: string
  name: string
  email: string
  pendingLeads: number
  resolvedToday: number
  confirmedToday: number
  cancelledToday: number
  callsMadeToday: number
  isOnline?: boolean
}

interface QueueData {
  totalNew: number
  unassigned: number
  byAgent: { agentId: string | null; count: number }[]
}

export default function AdminCallCenterPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [agents, setAgents] = useState<AgentStat[]>([])
  const [queue, setQueue] = useState<QueueData>({ totalNew: 0, unassigned: 0, byAgent: [] })
  const [loading, setLoading] = useState(true)
  const [reassignDialog, setReassignDialog] = useState<AgentStat | null>(null)
  const [targetAgentId, setTargetAgentId] = useState('')
  const [reassigning, setReassigning] = useState(false)

  useEffect(() => {
    if (userLoading) return
    if (!user) { router.push('/login'); return }
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') { router.push('/unauthorized'); return }
    fetchData()
  }, [user, userLoading, router])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/call-center')
      if (res.ok) {
        const data = await res.json()
        setAgents(data.agents ?? [])
        setQueue(data.queue ?? { totalNew: 0, unassigned: 0, byAgent: [] })
      }
    } catch {
      toast.error('Failed to load call center data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') fetchData()
  }, [user, fetchData])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleReassign = async () => {
    if (!reassignDialog || !targetAgentId) return
    setReassigning(true)
    try {
      const res = await fetch('/api/admin/call-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAgentId: reassignDialog.id, toAgentId: targetAgentId })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`${data.reassigned} leads reassigned to ${data.toAgent}`)
        setReassignDialog(null)
        setTargetAgentId('')
        fetchData()
      } else {
        toast.error(data.error || 'Reassignment failed')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setReassigning(false)
    }
  }

  if (userLoading || !user) return null

  const totalConfirmedToday = agents.reduce((s, a) => s + a.confirmedToday, 0)
  const totalCallsToday = agents.reduce((s, a) => s + a.callsMadeToday, 0)
  const confirmRate = totalCallsToday > 0
    ? Math.round((totalConfirmedToday / totalCallsToday) * 100)
    : 0

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Phone className="h-6 w-6 text-primary" />
              Call Center Overview
            </h1>
            <p className="text-muted-foreground">Live agent performance and queue management</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Summary KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Queue (NEW)',
              value: queue.totalNew,
              sub: `${queue.unassigned} unassigned`,
              icon: Inbox,
              color: 'text-amber-600',
              bg: 'bg-amber-50 dark:bg-amber-950/30'
            },
            {
              label: 'Active Agents',
              value: agents.length,
              sub: 'CALL_CENTER users',
              icon: Users,
              color: 'text-blue-600',
              bg: 'bg-blue-50 dark:bg-blue-950/30'
            },
            {
              label: 'Confirmed Today',
              value: totalConfirmedToday,
              sub: 'across all agents',
              icon: CheckCircle2,
              color: 'text-emerald-600',
              bg: 'bg-emerald-50 dark:bg-emerald-950/30'
            },
            {
              label: 'Confirm Rate',
              value: `${confirmRate}%`,
              sub: `${totalCallsToday} calls made`,
              icon: TrendingUp,
              color: 'text-indigo-600',
              bg: 'bg-indigo-50 dark:bg-indigo-950/30'
            },
          ].map((s, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  <p className="text-2xl font-bold mt-0.5">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
                </div>
                <div className={cn('p-2.5 rounded-xl', s.bg)}>
                  <s.icon className={cn('h-5 w-5', s.color)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Unassigned leads warning */}
        {queue.unassigned > 0 && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800 dark:text-amber-200">
                {queue.unassigned} leads are unassigned
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                These orders are visible to all agents in the shared pool. Add CALL_CENTER agents to enable auto-assignment.
              </p>
            </div>
          </div>
        )}

        {/* Per-agent table */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Agent Performance — Today</CardTitle>
            <CardDescription>Live stats. Auto-refreshes every 30 seconds.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-b-lg overflow-hidden border-t border-border/40">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="pl-6">Agent</TableHead>
                    <TableHead className="text-center">Pending Leads</TableHead>
                    <TableHead className="text-center">Calls Made</TableHead>
                    <TableHead className="text-center">Confirmed</TableHead>
                    <TableHead className="text-center">Cancelled</TableHead>
                    <TableHead className="text-center">Confirm Rate</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Loading...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : agents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        No CALL_CENTER agents found. Create agents in User Management.
                      </TableCell>
                    </TableRow>
                  ) : (
                    agents.map((agent) => {
                      const rate = agent.callsMadeToday > 0
                        ? Math.round((agent.confirmedToday / agent.callsMadeToday) * 100)
                        : 0
                      return (
                        <TableRow key={agent.id} className="hover:bg-muted/20">
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-semibold flex items-center gap-2">
                                  {agent.name}
                                  {agent.isOnline ? (
                                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                                      Online
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs text-muted-foreground">
                                      Offline
                                    </Badge>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">{agent.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              className={cn(
                                'font-bold text-sm',
                                agent.pendingLeads > 10
                                  ? 'bg-red-100 text-red-700 border-red-200'
                                  : agent.pendingLeads > 5
                                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                                  : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              )}
                            >
                              {agent.pendingLeads}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-semibold">{agent.callsMadeToday}</TableCell>
                          <TableCell className="text-center">
                            <span className="flex items-center justify-center gap-1 text-emerald-600 font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {agent.confirmedToday}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="flex items-center justify-center gap-1 text-rose-600 font-semibold">
                              <XCircle className="h-3.5 w-3.5" />
                              {agent.cancelledToday}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    rate >= 50 ? 'bg-emerald-500' : rate >= 30 ? 'bg-amber-500' : 'bg-rose-500'
                                  )}
                                  style={{ width: `${Math.min(rate, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold">{rate}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1"
                              onClick={() => setReassignDialog(agent)}
                              disabled={agent.pendingLeads === 0}
                            >
                              <ArrowRightLeft className="h-3 w-3" />
                              Reassign
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call time guide */}
        <Card className="border-border/50 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Best call windows for Gabon</p>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">12:00–14:00</span> (lunch break) ·
                  <span className="font-medium text-foreground ml-2">18:00–21:00</span> (evening) ·
                  Avoid 9–11am for Franceville/Oyem (connectivity issues)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reassign Dialog */}
      <Dialog open={!!reassignDialog} onOpenChange={(o) => { if (!o) { setReassignDialog(null); setTargetAgentId('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Leads</DialogTitle>
            <DialogDescription>
              Move all {reassignDialog?.pendingLeads} pending leads from{' '}
              <strong>{reassignDialog?.name}</strong> to another agent.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={targetAgentId} onValueChange={setTargetAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select target agent..." />
              </SelectTrigger>
              <SelectContent>
                {agents
                  .filter(a => a.id !== reassignDialog?.id)
                  .map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.pendingLeads} pending)
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setReassignDialog(null); setTargetAgentId('') }}>
              Cancel
            </Button>
            <Button
              disabled={!targetAgentId || reassigning}
              onClick={handleReassign}
              className="gap-2"
            >
              <ArrowRightLeft className="h-4 w-4" />
              {reassigning ? 'Reassigning...' : `Reassign ${reassignDialog?.pendingLeads} leads`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
