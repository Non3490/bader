'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Activity,
  RefreshCcw,
  Search,
  Clock,
  Shield,
  Globe,
  User,
  History,
  ArrowUpRight,
  Filter,
  Layers,
  Download
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogEntry {
  id: string
  action: string
  details: string
  role: string
  ipAddress: string | null
  createdAt: string
  user: { id: string; name: string; email: string; role: string }
}

const actionColors: Record<string, string> = {
  LOGIN: 'bg-blue-500/10 text-blue-600 border-blue-200',
  ORDER_STATUS_UPDATE: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
  EXPENSE_CREATED: 'bg-rose-500/10 text-rose-600 border-rose-200',
  USER_CREATED: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  WITHDRAWAL_REQUESTED: 'bg-amber-500/10 text-amber-600 border-amber-200',
  WITHDRAWAL_PROCESSED: 'bg-purple-500/10 text-purple-600 border-purple-200',
  CATALOG_PRODUCT_CREATED: 'bg-teal-500/10 text-teal-600 border-teal-200',
  SOURCING_REQUEST_CREATED: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
  SOURCING_REQUEST_REVIEWED: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
  TEAM_MEMBER_ADDED: 'bg-pink-500/10 text-pink-600 border-pink-200',
  API_KEY_GENERATED: 'bg-slate-500/10 text-slate-600 border-slate-200'
}

export default function ActivityLogsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!userLoading && !user) router.push('/login')
    if (!userLoading && user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') router.push('/unauthorized')
  }, [user, userLoading, router])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (search) params.set('action', search)
      const res = await fetch(`/api/activity-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setTotal(data.total ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }

  const exportCsv = () => {
    const params = new URLSearchParams({ export: 'csv' })
    if (search) params.set('action', search)
    window.open(`/api/activity-logs?${params}`, '_blank')
  }

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') fetchLogs()
  }, [user])

  if (userLoading || !user) return null

  return (
    <>
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-indigo-600/10 rounded-lg">
                <History className="h-5 w-5 text-indigo-600" />
              </div>
              <span className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">System Audit</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              Activity Logs
            </h1>
            <p className="text-slate-500 text-lg max-w-2xl">
              Monitor and track all system events, user actions, and security-sensitive operations across the platform.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <Input
                placeholder="Search actions..."
                className="pl-10 h-11 bg-white border-slate-200 shadow-sm rounded-xl focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchLogs()}
              />
            </div>
            <Button
              onClick={exportCsv}
              variant="outline"
              className="h-11 px-5 rounded-xl border-slate-200 hover:bg-slate-50 hover:text-emerald-600 transition-all flex gap-2 shadow-sm bg-white w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              <span className="font-medium text-sm">Export CSV</span>
            </Button>
            <Button
              onClick={fetchLogs}
              variant="outline"
              className="h-11 px-5 rounded-xl border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-all flex gap-2 group shadow-sm bg-white w-full sm:w-auto"
              disabled={loading}
            >
              <RefreshCcw className={cn("h-4 w-4 transition-transform", loading && "animate-spin")} />
              <span className="font-medium text-sm">Refresh Data</span>
            </Button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="relative overflow-hidden border-none shadow-2xl shadow-indigo-500/10 bg-gradient-to-br from-indigo-600 to-violet-700 text-white">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Layers className="h-24 w-24" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-indigo-100 text-sm font-medium uppercase tracking-wider">Total Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-1">{total.toLocaleString()}</div>
              <p className="text-indigo-100/80 text-sm flex items-center gap-1">
                Audit trail active <ArrowUpRight className="h-3 w-3" />
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/60 shadow-lg shadow-slate-200/50 bg-white/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-500 text-sm font-medium uppercase tracking-wider">Recent Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-slate-900 mb-1">{logs.length}</div>
              <p className="text-emerald-600 text-sm font-medium flex items-center gap-1">
                Displaying latest page <Activity className="h-3 w-3" />
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/60 shadow-lg shadow-slate-200/50 bg-white/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-500 text-sm font-medium uppercase tracking-wider">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20" />
                <span className="text-2xl font-bold text-slate-900">Operational</span>
              </div>
              <p className="text-slate-500 text-sm mt-2 flex items-center gap-1">
                Last updated {new Date().toLocaleTimeString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table Area */}
        <Card className="border-none shadow-2xl shadow-slate-200/50 overflow-hidden bg-white">
          <CardHeader className="border-b border-slate-100 bg-slate-50/30 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-600 uppercase tracking-tighter">Event Timeline</span>
              </div>
              <Badge variant="secondary" className="bg-slate-200/50 text-slate-600 font-medium">
                Showing {logs.length} of {total}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 bg-slate-50/10">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <History className="h-5 w-5 text-indigo-600" />
                  </div>
                </div>
                <p className="text-slate-400 font-medium animate-pulse">Syncing logs from database...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="bg-slate-50 p-6 rounded-full mb-4">
                  <Activity className="h-12 w-12 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">No activity logs found</h3>
                <p className="text-slate-500 max-w-xs mx-auto">Try adjusting your filters or search terms to find what you're looking for.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User & Role</th>
                      <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Action Type</th>
                      <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Details</th>
                      <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Connectivity</th>
                      <th className="text-right px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {logs.map((log, index) => (
                      <tr 
                        key={log.id} 
                        className="group hover:bg-slate-50/80 transition-all duration-200"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 group-hover:bg-white group-hover:shadow-sm transition-all">
                              <User className="h-4 w-4 text-slate-600" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-900">{log.user.name}</span>
                              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight text-slate-400">
                                <Shield className="h-3 w-3" />
                                {log.role}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold border",
                            actionColors[log.action] || 'bg-slate-100 text-slate-700 border-slate-200'
                          )}>
                            {log.action.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600 font-medium max-w-md truncate leading-relaxed">
                            {log.details}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Globe className="h-3.5 w-3.5" />
                            <span className="text-xs font-mono font-medium">{log.ipAddress || 'Internal System'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-tighter">
                              {new Date(log.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
          <div className="px-6 py-4 bg-slate-50/30 border-t border-slate-100">
            <p className="text-xs text-slate-400 font-medium text-center">
              Logs are stored for compliance for 365 days. End of records.
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}
