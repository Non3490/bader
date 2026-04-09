'use client'

import { useEffect, useState, useCallback } from 'react'
import { TopBar, KpiStrip, PageShell } from '@/components/layout'
import { Search, Package, Loader2, ChevronLeft, ChevronRight, RefreshCw, Truck, CheckCircle2, AlertCircle, Banknote, ArrowRightLeft, Navigation, Clock as ClockIcon } from 'lucide-react'
import { toast } from 'sonner'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Delivery {
  id: string
  status: string
  createdAt: string
  driver: { id: string; name: string; phone: string } | null
  order: {
    trackingNumber: string
    recipientName: string
    phone: string
    address: string
    city: string
    codAmount: number
    status: string
  } | null
}

interface DeliveryManStat {
  id: string
  name: string
  email: string
  phone: string | null
  assigned: number
  deliveredToday: number
  returnedToday: number
  postponedToday: number
  cashCollectedToday: number
  pendingRemittance: number
  deliveryRate: number
  feeConfig?: {
    costPerDelivery: number
    bonusAmount: number
    penaltyAmount: number
  }
}

interface Summary {
  totalDeliveredToday: number
  totalCashToday: number
  totalPendingRemittance: number
  totalAssigned: number
  unassignedConfirmed: number
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ASSIGNED:    { label: 'Assigned',    color: 'bg-blue-100 text-blue-600' },
  PICKED_UP:   { label: 'Picked Up',   color: 'bg-purple-100 text-purple-600' },
  IN_TRANSIT:  { label: 'In Transit',  color: 'bg-yellow-100 text-yellow-600' },
  SHIPPED:     { label: 'Shipped',     color: 'bg-indigo-100 text-indigo-600' },
  DELIVERED:   { label: 'Delivered',   color: 'bg-green-100 text-green-600' },
  FAILED:      { label: 'Failed',      color: 'bg-red-100 text-red-500' },
  RETURNED:    { label: 'Returned',    color: 'bg-gray-100 text-gray-500' },
  POSTPONED:   { label: 'Postponed',   color: 'bg-amber-100 text-amber-600' },
}

const PAGE_SIZE = 20

function fmt(n: number) {
  return new Intl.NumberFormat('en-GA', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n)
}

export default function DeliveriesPage() {
  // Deliveries list state
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Overview / assign state (merged from admin/delivery)
  const [deliveryMen, setDeliveryMen] = useState<DeliveryManStat[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [assignDialog, setAssignDialog] = useState(false)
  const [assignTo, setAssignTo] = useState('')
  const [assignCity, setAssignCity] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [nearestDrivers, setNearestDrivers] = useState<any[]>([])
  const [loadingNearest, setLoadingNearest] = useState(false)

  // Reassign dialog
  const [reassignFrom, setReassignFrom] = useState<DeliveryManStat | null>(null)
  const [reassignTo, setReassignTo] = useState('')
  const [reassigning, setReassigning] = useState(false)

  // Fee config dialog
  const [feeDialog, setFeeDialog] = useState<DeliveryManStat | null>(null)
  const [feeConfig, setFeeConfig] = useState({
    costPerDelivery: 0,
    bonusAmount: 0,
    penaltyAmount: 0
  })
  const [savingFee, setSavingFee] = useState(false)

  // Active view: 'list' or 'overview'
  const [view, setView] = useState<'list' | 'overview'>('list')

  const loadDeliveries = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/admin/deliveries?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDeliveries(data.deliveries ?? [])
      setTotal(data.total ?? 0)
    } catch {
      toast.error('Failed to load deliveries')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/delivery-overview')
      if (res.ok) {
        const data = await res.json()
        setDeliveryMen(data.deliveryMen ?? [])
        setSummary(data.summary ?? null)
      }
    } catch {
      // silently fail - overview is supplementary
    }
  }, [])

  useEffect(() => { loadDeliveries(); fetchOverview() }, [page, statusFilter, fetchOverview])

  // Auto-refresh overview every 30s
  useEffect(() => {
    const interval = setInterval(fetchOverview, 30000)
    return () => clearInterval(interval)
  }, [fetchOverview])

  // Nearest drivers search
  const fetchNearestDrivers = async (city: string) => {
    if (!city || city.length < 2) { setNearestDrivers([]); return }
    setLoadingNearest(true)
    try {
      const res = await fetch(`/api/delivery/location?address=${encodeURIComponent(city)}&city=${encodeURIComponent(city)}&limit=5`)
      if (res.ok) {
        const data = await res.json()
        setNearestDrivers(data.suggestions || [])
      }
    } catch (error) {
      console.error('Failed to fetch nearest drivers:', error)
    } finally {
      setLoadingNearest(false)
    }
  }

  useEffect(() => {
    if (assignCity) {
      const debounceTimer = setTimeout(() => fetchNearestDrivers(assignCity), 500)
      return () => clearTimeout(debounceTimer)
    }
    setNearestDrivers([])
  }, [assignCity])

  const handleAssign = async () => {
    if (!assignTo) return
    setAssigning(true)
    try {
      const body: Record<string, string> = { deliveryManId: assignTo }
      if (assignCity) body.city = assignCity
      const res = await fetch('/api/admin/delivery-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`${data.assigned} orders assigned & marked SHIPPED -> ${data.to}`)
        setAssignDialog(false)
        setAssignTo('')
        setAssignCity('')
        setNearestDrivers([])
        fetchOverview()
        loadDeliveries(true)
      } else {
        toast.error(data.error || 'Assignment failed')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setAssigning(false)
    }
  }

  const handleReassign = async () => {
    if (!reassignFrom || !reassignTo) return
    setReassigning(true)
    try {
      const shippedOrders = await fetch(`/api/orders?status=SHIPPED&limit=200`)
      const ordersData = await shippedOrders.json()
      const fromIds = (ordersData.orders ?? [])
        .filter((o: { deliveryManId: string }) => o.deliveryManId === reassignFrom.id)
        .map((o: { id: string }) => o.id)

      if (fromIds.length === 0) {
        toast.info('No SHIPPED orders to reassign')
        setReassignFrom(null)
        setReassigning(false)
        return
      }

      const res = await fetch('/api/admin/delivery-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryManId: reassignTo, orderIds: fromIds })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`${data.assigned} orders reassigned -> ${data.to}`)
        setReassignFrom(null)
        setReassignTo('')
        fetchOverview()
        loadDeliveries(true)
      } else {
        toast.error(data.error || 'Reassignment failed')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setReassigning(false)
    }
  }

  const handleOpenFeeDialog = (dm: DeliveryManStat, currentConfig?: any) => {
    setFeeDialog(dm)
    if (currentConfig) {
      setFeeConfig({
        costPerDelivery: currentConfig.costPerDelivery || 0,
        bonusAmount: currentConfig.bonusAmount || 0,
        penaltyAmount: currentConfig.penaltyAmount || 0
      })
    } else {
      setFeeConfig({ costPerDelivery: 0, bonusAmount: 0, penaltyAmount: 0 })
    }
  }

  const handleSaveFeeConfig = async () => {
    if (!feeDialog) return
    setSavingFee(true)
    try {
      const res = await fetch('/api/delivery-fee-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryManId: feeDialog.id, ...feeConfig })
      })
      if (!res.ok) throw new Error('Failed to save fee config')
      toast.success('Fee config saved')
      setFeeDialog(null)
      fetchOverview()
    } catch {
      toast.error('Failed to save fee config')
    } finally {
      setSavingFee(false)
    }
  }

  const filtered = deliveries.filter((d) => {
    const q = searchQuery.toLowerCase()
    return (
      (d.order?.trackingNumber || '').toLowerCase().includes(q) ||
      (d.order?.recipientName || '').toLowerCase().includes(q) ||
      (d.driver?.name || '').toLowerCase().includes(q) ||
      (d.order?.city || '').toLowerCase().includes(q)
    )
  })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const kpiItems = view === 'list' ? [
    { label: 'Total Deliveries', value: String(total), subtitle: 'RECORDED', color: 'info' as const },
    { label: 'Page', value: `${page}/${totalPages || 1}`, subtitle: 'NAVIGATION', color: 'dark' as const },
  ] : summary ? [
    { label: 'Delivered Today', value: String(summary.totalDeliveredToday), subtitle: 'PACKAGES', color: 'success' as const },
    { label: 'Cash Today', value: summary.totalCashToday.toLocaleString(), subtitle: 'FCFA', color: 'orange' as const },
    { label: 'In Transit', value: String(summary.totalAssigned), subtitle: 'SHIPPED', color: 'info' as const },
    { label: 'Unassigned', value: String(summary.unassignedConfirmed), subtitle: 'CONFIRMED', color: 'dark' as const },
  ] : []

  if (loading) {
    return (
      <PageShell role="admin" activePage="deliveries">
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell role="admin" activePage="deliveries">
      <div className="min-h-screen bg-background">
        <TopBar
          title={view === 'list' ? 'Delivery List' : 'Delivery Overview'}
          actions={
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex rounded-lg border border-[#e5e5e5] overflow-hidden">
                <button
                  onClick={() => setView('list')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium transition-colors',
                    view === 'list' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  )}
                >
                  List
                </button>
                <button
                  onClick={() => setView('overview')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium transition-colors',
                    view === 'overview' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  )}
                >
                  Overview
                </button>
              </div>

              {view === 'overview' && (
                <button
                  onClick={() => setAssignDialog(true)}
                  className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors"
                >
                  <Package className="w-4 h-4" />
                  Assign Orders
                </button>
              )}

              <button
                onClick={() => view === 'list' ? loadDeliveries(true) : fetchOverview()}
                disabled={refreshing}
                className="flex items-center gap-2 bg-white border border-[#e5e5e5] text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
                Refresh
              </button>
            </div>
          }
        />

        <div className="p-8 pt-[70px] pb-12 space-y-8">
          <KpiStrip items={kpiItems} />

          {view === 'list' ? (
            <>
              {/* Filters */}
              <div className="bg-[#f8f8f8] p-4 rounded-xl flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by tracking, customer, driver, city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#e5e5e5] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                  className="bg-white border border-[#e5e5e5] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                >
                  <option value="">All statuses</option>
                  {Object.entries(STATUS_LABELS).map(([val, { label }]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-[#e5e5e5] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Tracking</th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Driver</th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">City</th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">COD</th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-16 text-gray-400">
                            <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                            <p className="text-sm">No deliveries found</p>
                          </td>
                        </tr>
                      ) : filtered.map((d) => {
                        const st = STATUS_LABELS[d.status] || { label: d.status, color: 'bg-gray-100 text-gray-500' }
                        return (
                          <tr key={d.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-gray-600">{d.order?.trackingNumber || '--'}</td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-800">{d.order?.recipientName || '--'}</p>
                              <p className="text-xs text-gray-400">{d.order?.phone || ''}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{d.driver?.name || <span className="text-gray-300 italic">Unassigned</span>}</td>
                            <td className="px-4 py-3 text-gray-600">{d.order?.city || '--'}</td>
                            <td className="px-4 py-3 font-semibold text-gray-800">{d.order?.codAmount?.toLocaleString() || '0'} FCFA</td>
                            <td className="px-4 py-3">
                              <span className={cn('px-2 py-1 rounded-lg text-[10px] font-semibold', st.color)}>{st.label}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400">{new Date(d.createdAt).toLocaleDateString()}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-[#f0f0f0]">
                    <p className="text-xs text-gray-400">{total} deliveries total</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1.5 rounded-lg border border-[#e5e5e5] hover:bg-[#f8f8f8] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-medium text-gray-700">{page} / {totalPages}</span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-1.5 rounded-lg border border-[#e5e5e5] hover:bg-[#f8f8f8] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Overview View (merged from admin/delivery) */}
              {/* Unassigned warning */}
              {summary && summary.unassignedConfirmed > 0 && (
                <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />
                  <p className="text-sm text-yellow-800 font-medium">
                    <span className="font-bold">{summary.unassignedConfirmed}</span> confirmed orders waiting for delivery assignment.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setAssignDialog(true)} className="ml-auto">
                    Assign Now
                  </Button>
                </div>
              )}

              {/* Driver cards */}
              {deliveryMen.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Truck className="w-12 h-12 mb-4 opacity-40" />
                  <p className="text-sm font-medium">No delivery men active</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deliveryMen.map((dm) => (
                    <div key={dm.id} className="bg-white rounded-xl border border-[#e5e5e5] p-6 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-base">
                            {dm.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900">{dm.name}</h4>
                            {dm.phone && (
                              <a href={`tel:${dm.phone}`} className="text-xs text-gray-400 hover:underline">{dm.phone}</a>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-center">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">In Transit</p>
                            <p className="text-xl font-bold text-blue-600">{dm.assigned}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Delivered</p>
                            <p className="text-xl font-bold text-green-600">{dm.deliveredToday}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Returned</p>
                            <p className="text-xl font-bold text-red-600">{dm.returnedToday}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Cash</p>
                            <p className="text-base font-bold text-green-600">{fmt(dm.cashCollectedToday)}</p>
                          </div>

                          {/* Delivery rate */}
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  dm.deliveryRate >= 65 ? 'bg-green-500' : dm.deliveryRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                )}
                                style={{ width: `${Math.min(dm.deliveryRate, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold">{dm.deliveryRate}%</span>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs h-8"
                            onClick={() => setReassignFrom(dm)}
                            disabled={dm.assigned === 0}
                          >
                            <ArrowRightLeft className="h-3 w-3" />
                            Reassign
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs h-8"
                            onClick={() => handleOpenFeeDialog(dm)}
                          >
                            <Banknote className="h-3 w-3" />
                            Fees
                          </Button>
                        </div>
                      </div>

                      {/* Pending remittance */}
                      {dm.pendingRemittance > 0 && (
                        <div className="mt-4 p-3 bg-amber-50 rounded-lg flex items-center justify-between text-xs">
                          <span className="text-amber-700">Pending remittance</span>
                          <span className="font-bold text-amber-800">{fmt(dm.pendingRemittance)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Delivery benchmarks */}
              <div className="p-5 bg-gradient-to-br from-orange-50 to-transparent rounded-xl border border-orange-100">
                <p className="font-semibold text-sm mb-2">Gabon delivery benchmarks</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-500">
                  <div><span className="font-medium text-gray-800">Libreville:</span> target 65-70%</div>
                  <div><span className="font-medium text-gray-800">Port-Gentil:</span> target 50-60%</div>
                  <div><span className="font-medium text-gray-800">Franceville:</span> target 35-45%</div>
                  <div><span className="font-medium text-gray-800">Oyem:</span> target 20-35%</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Assign Orders Dialog */}
      <Dialog open={assignDialog} onOpenChange={(open) => {
        setAssignDialog(open)
        if (!open) { setAssignTo(''); setAssignCity(''); setNearestDrivers([]) }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Assign Orders to Delivery
            </DialogTitle>
            <DialogDescription>
              Assigns confirmed orders to a delivery man and marks them SHIPPED automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Filter by City (optional)</Label>
              <Input
                placeholder="e.g. Libreville, Port-Gentil..."
                value={assignCity}
                onChange={e => setAssignCity(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Enter city to see nearest drivers based on GPS location.</p>
            </div>

            {/* Nearest Drivers Suggestions */}
            {assignCity && nearestDrivers.length > 0 && (
              <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <Label className="flex items-center gap-2 text-primary">
                  <Navigation className="h-4 w-4" />
                  Nearest Drivers to {assignCity}
                </Label>
                {loadingNearest ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 h-4 animate-spin" />
                    Finding nearest drivers...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {nearestDrivers.map((suggestion, idx) => (
                      <div
                        key={suggestion.driver.id}
                        className={cn(
                          'flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors',
                          idx === 0 ? 'bg-emerald-100 border border-emerald-200' : 'hover:bg-muted/50'
                        )}
                        onClick={() => setAssignTo(suggestion.driver.id)}
                      >
                        <div className="flex items-center gap-2">
                          {idx === 0 && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                          <div>
                            <p className="text-sm font-medium">{suggestion.driver.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {suggestion.driver.phone ? suggestion.driver.phone : 'No phone'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-blue-600">{suggestion.distanceKm} km</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ClockIcon className="h-3 w-3" />
                            ~{suggestion.estimatedMinutes} min
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Delivery Man</Label>
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select delivery man..." />
                </SelectTrigger>
                <SelectContent>
                  {deliveryMen.map(dm => (
                    <SelectItem key={dm.id} value={dm.id}>
                      {dm.name} ({dm.assigned} in transit)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setAssignDialog(false); setAssignTo(''); setAssignCity(''); setNearestDrivers([]) }}>
              Cancel
            </Button>
            <Button disabled={!assignTo || assigning} onClick={handleAssign} className="gap-2">
              <Truck className="h-4 w-4" />
              {assigning ? 'Assigning...' : 'Assign & Ship'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={!!reassignFrom} onOpenChange={o => { if (!o) { setReassignFrom(null); setReassignTo('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Orders</DialogTitle>
            <DialogDescription>
              Move all <strong>{reassignFrom?.assigned}</strong> in-transit orders from{' '}
              <strong>{reassignFrom?.name}</strong> to another delivery man.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select new delivery man..." />
              </SelectTrigger>
              <SelectContent>
                {deliveryMen
                  .filter(d => d.id !== reassignFrom?.id)
                  .map(dm => (
                    <SelectItem key={dm.id} value={dm.id}>
                      {dm.name} ({dm.assigned} current orders)
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setReassignFrom(null); setReassignTo('') }}>
              Cancel
            </Button>
            <Button disabled={!reassignTo || reassigning} onClick={handleReassign} className="gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              {reassigning ? 'Reassigning...' : 'Reassign All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fee Config Dialog */}
      <Dialog open={!!feeDialog} onOpenChange={o => { if (!o) setFeeDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delivery Fee Config</DialogTitle>
            <DialogDescription>
              Set delivery fee, bonus, and penalty for <strong>{feeDialog?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="costPerDelivery">Cost Per Delivery (XAF)</Label>
              <Input
                id="costPerDelivery"
                type="number"
                value={feeConfig.costPerDelivery}
                onChange={e => setFeeConfig({ ...feeConfig, costPerDelivery: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bonusAmount">Bonus Amount (XAF)</Label>
              <Input
                id="bonusAmount"
                type="number"
                value={feeConfig.bonusAmount}
                onChange={e => setFeeConfig({ ...feeConfig, bonusAmount: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="penaltyAmount">Penalty Amount (XAF)</Label>
              <Input
                id="penaltyAmount"
                type="number"
                value={feeConfig.penaltyAmount}
                onChange={e => setFeeConfig({ ...feeConfig, penaltyAmount: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFeeDialog(null)}>
              Cancel
            </Button>
            <Button disabled={savingFee} onClick={handleSaveFeeConfig} className="gap-2">
              <Banknote className="h-4 w-4" />
              {savingFee ? 'Saving...' : 'Save Config'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
