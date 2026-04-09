'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarClock,
  CheckCircle,
  CheckCircle2,
  Loader2,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useUser } from '@/hooks/use-user'
import { toast } from 'sonner'
import { LowStockCriticalAlert } from '@/components/inventory/LowStockCriticalAlert'

interface DashboardData {
  kpis: {
    callsMade: number
    dailyTarget: number
    confirmed: number
    cancelled: number
    confirmRate: number
  }
}

interface PerformanceData {
  todayVsYesterday: {
    today: { calls: number; confirmed: number; cancelled: number; rate: number }
    yesterday: { calls: number; confirmed: number; cancelled: number; rate: number }
    change: { calls: number; confirmed: number; rate: number }
  }
  average7d: {
    avgCallsPerDay: number
    avgConfirmedPerDay: number
    avgRate: number
    bestDay: { label: string; calls: number } | null
  }
}

interface PriorityOrder {
  id: string
  customerName: string
  sellerName: string
  codAmount: number
  scheduledCallAt: string | null
}

interface CallbackItem {
  id: string
  orderId: string
  customerName: string
  customerPhone: string
  scheduledCallAt: string | null
  city: string
}

const kpiCards = [
  { key: 'callsMade', label: 'Calls Made', color: '#f07020' },
  { key: 'confirmed', label: 'Confirmed', color: '#16a34a' },
  { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
  { key: 'confirmRate', label: 'Confirm Rate', color: '#f07020' }
] as const

export default function AgentDashboardPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [performance, setPerformance] = useState<PerformanceData | null>(null)
  const [priorityOrders, setPriorityOrders] = useState<PriorityOrder[]>([])
  const [callbacks, setCallbacks] = useState<CallbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarLoading, setSidebarLoading] = useState(true)

  useEffect(() => {
    if (!userLoading && !user) router.push('/login')
    if (!userLoading && user && user.role !== 'CALL_CENTER') router.push('/')
  }, [router, user, userLoading])

  useEffect(() => {
    if (!user || user.role !== 'CALL_CENTER') return

    async function loadMain() {
      setLoading(true)
      try {
        const [dashboardRes, performanceRes] = await Promise.all([
          fetch('/api/agents/dashboard', { cache: 'no-store' }),
          fetch('/api/agents/performance', { cache: 'no-store' })
        ])

        if (!dashboardRes.ok || !performanceRes.ok) {
          throw new Error('Failed to load dashboard')
        }

        const dashboardData = await dashboardRes.json()
        setDashboard(dashboardData)
        window.dispatchEvent(new CustomEvent('agent-stats-updated', {
          detail: {
            totalCalls: dashboardData.kpis.callsMade ?? 0,
            confirmed: dashboardData.kpis.confirmed ?? 0,
            cancelled: dashboardData.kpis.cancelled ?? 0,
          }
        }))
        setPerformance(await performanceRes.json())
      } catch (error) {
        console.error(error)
        toast.error('Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    async function loadSidebar() {
      setSidebarLoading(true)
      try {
        const [priorityRes, callbacksRes] = await Promise.all([
          fetch('/api/orders/priority-queue', { cache: 'no-store' }),
          fetch('/api/callbacks/today', { cache: 'no-store' })
        ])

        if (!priorityRes.ok || !callbacksRes.ok) {
          throw new Error('Failed to load queue cards')
        }

        const priorityData = await priorityRes.json()
        const callbackData = await callbacksRes.json()

        setPriorityOrders((priorityData.orders || []).filter((order: { _score: number }) => order._score >= 5000))
        setCallbacks(callbackData || [])
      } catch (error) {
        console.error(error)
      } finally {
        setSidebarLoading(false)
      }
    }

    loadMain()
    loadSidebar()

    const intervalId = window.setInterval(loadSidebar, 60000)
    return () => window.clearInterval(intervalId)
  }, [user])

  if (userLoading || loading || !dashboard || !performance) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f8f8]">
        <Loader2 className="h-8 w-8 animate-spin text-[#f07020]" />
      </div>
    )
  }

  if (!user || user.role !== 'CALL_CENTER') return null

  return (
    <>
      {/* Low Stock Alerts Banner - Call Center sees all alerts */}
      <LowStockCriticalAlert showForAll={true} />
      <div className="space-y-6 font-sora">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-[#111111]">Agent Dashboard</h1>
            <p className="text-[11px] text-[#888888]">Your queue, callbacks, and daily performance at a glance.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-[11px] font-semibold text-[#555555] md:flex">
            <Bell className="h-4 w-4 text-[#f07020]" />
            Live agent summary
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((card) => (
            <KpiCard
              key={card.key}
              label={card.label}
              color={card.color}
              value={
                card.key === 'callsMade'
                  ? `${dashboard.kpis.callsMade} / ${dashboard.kpis.dailyTarget}`
                  : card.key === 'confirmed'
                    ? dashboard.kpis.confirmed
                    : card.key === 'cancelled'
                      ? dashboard.kpis.cancelled
                      : `${dashboard.kpis.confirmRate}%`
              }
              progress={card.key === 'callsMade'
                ? Math.min(100, (dashboard.kpis.callsMade / dashboard.kpis.dailyTarget) * 100)
                : undefined}
              delta={card.key === 'callsMade'
                ? performance.todayVsYesterday.change.calls
                : card.key === 'confirmed'
                  ? performance.todayVsYesterday.change.confirmed
                  : card.key === 'confirmRate'
                    ? performance.todayVsYesterday.change.rate
                    : 0}
              circularValue={card.key === 'confirmRate' ? dashboard.kpis.confirmRate : undefined}
            />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card className="rounded-xl border border-[#e5e5e5] bg-white py-0 shadow-none">
              <CardHeader className="border-b border-[#efefef] px-4 py-4">
                <CardTitle className="text-[13px] font-bold text-[#111111]">Today vs Yesterday</CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-4">
                <ComparisonRow label="Calls" today={performance.todayVsYesterday.today.calls} yesterday={performance.todayVsYesterday.yesterday.calls} change={performance.todayVsYesterday.change.calls} />
                <ComparisonRow label="Confirmed" today={performance.todayVsYesterday.today.confirmed} yesterday={performance.todayVsYesterday.yesterday.confirmed} change={performance.todayVsYesterday.change.confirmed} />
                <ComparisonRow label="Rate" today={`${performance.todayVsYesterday.today.rate}%`} yesterday={`${performance.todayVsYesterday.yesterday.rate}%`} change={performance.todayVsYesterday.change.rate} />
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-[#e5e5e5] bg-white py-0 shadow-none">
              <CardHeader className="border-b border-[#efefef] px-4 py-4">
                <CardTitle className="text-[13px] font-bold text-[#111111]">7-Day Average</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 py-4 text-[12px]">
                <MetricLine label="Avg calls/day" value={performance.average7d.avgCallsPerDay} />
                <MetricLine label="Avg confirmed/day" value={performance.average7d.avgConfirmedPerDay} />
                <MetricLine label="Avg rate" value={`${performance.average7d.avgRate}%`} />
                <MetricLine label="Best day" value={performance.average7d.bestDay ? `${performance.average7d.bestDay.label} (${performance.average7d.bestDay.calls} calls)` : 'No data'} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <PriorityQueueCard orders={priorityOrders} loading={sidebarLoading} onOpenQueue={(orderId) => router.push(orderId ? `/call-center?select=${orderId}&section=priority` : '/call-center?section=priority')} />
            <CallbacksDueTodayCard callbacks={callbacks} loading={sidebarLoading} onCall={(orderId) => router.push(`/call-center?select=${orderId}`)} />
          </div>
        </div>
      </div>
    </>
  )
}

function PriorityQueueCard({
  orders,
  loading,
  onOpenQueue
}: {
  orders: PriorityOrder[]
  loading: boolean
  onOpenQueue: (orderId?: string) => void
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 animate-pulse">
        <div className="mb-2 h-4 w-32 rounded bg-[#f0f0f0]" />
        <div className="h-3 w-full rounded bg-[#f0f0f0]" />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-[#e5e5e5] bg-white p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0fdf4]">
            <CheckCircle2 size={14} className="text-[#16a34a]" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#111111]">Priority Queue</div>
            <div className="text-[9px] text-[#888888]">All clear</div>
          </div>
        </div>
        <span className="rounded-full bg-[#f0fdf4] px-1.5 py-0.5 text-[9px] font-bold text-[#16a34a]">0</span>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#e5e5e5] border-l-[3px] border-l-[#f07020] bg-white">
      <div className="flex items-center justify-between border-b border-[#f0f0f0] p-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#f07020]" />
          <span className="text-[11px] font-bold text-[#111111]">Priority Queue</span>
        </div>
        <span className="rounded-full bg-[#f07020] px-2 py-0.5 text-[9px] font-bold text-white">{orders.length}</span>
      </div>

      <div className="max-h-[240px] overflow-y-auto">
        {orders.slice(0, 4).map((order, index) => (
          <button
            key={order.id}
            type="button"
            onClick={() => onOpenQueue(order.id)}
            className={`flex w-full items-start justify-between border-b border-[#f0f0f0] p-2.5 text-left last:border-none ${index % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}`}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[10px] font-semibold text-[#111111]">{order.customerName}</div>
              <div className="truncate text-[9px] text-[#888888]">{order.sellerName || 'Unknown seller'}</div>
              {order.scheduledCallAt ? (
                <div className="mt-0.5 text-[8px] font-medium text-[#f07020]">
                  {new Date(order.scheduledCallAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              ) : null}
            </div>
            <div className="ml-2 whitespace-nowrap text-[10px] font-bold text-[#f07020]">
              {Math.round(order.codAmount).toLocaleString('fr-FR')} XAF
            </div>
          </button>
        ))}
      </div>

      <div className="border-t border-[#e5e5e5] bg-[#f8f8f8] p-2">
        <button onClick={() => onOpenQueue()} className="w-full rounded-lg bg-[#f07020] py-2 text-[10px] font-bold text-white transition hover:bg-[#d96500]">
          Go to Queue
        </button>
      </div>
    </div>
  )
}

function CallbacksDueTodayCard({
  callbacks,
  loading,
  onCall
}: {
  callbacks: CallbackItem[]
  loading: boolean
  onCall: (orderId: string) => void
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 animate-pulse">
        <div className="mb-3 h-4 w-40 rounded bg-[#f0f0f0]" />
        <div className="space-y-2">
          <div className="h-12 rounded bg-[#f0f0f0]" />
          <div className="h-12 rounded bg-[#f0f0f0]" />
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
      <div className="flex items-center justify-between border-b border-[#f0f0f0] p-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[#f07020]" />
          <span className="text-[11px] font-bold text-[#111111]">Callbacks Due Today</span>
        </div>
        <span className="rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[9px] font-bold text-[#888888]">{callbacks.length}</span>
      </div>

      <div className="max-h-[280px] overflow-y-auto">
        {callbacks.length === 0 ? (
          <div className="py-6 text-center text-[10px] text-[#888888]">No callbacks scheduled</div>
        ) : (
          callbacks.slice(0, 5).map((callback) => {
            const timeInfo = getTimeInfo(callback.scheduledCallAt)
            return (
              <div
                key={callback.id}
                className={`flex items-center gap-2 border-b border-[#f0f0f0] p-2.5 last:border-none ${timeInfo.isOverdue ? 'bg-[#fef2f2] border-l-[3px] border-l-[#dc2626]' : 'bg-white border-l-[3px] border-l-[#f07020]'}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-semibold text-[#111111]">{callback.customerName}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#f07020]">{timeInfo.timeText}</span>
                    <span className={`text-[9px] ${timeInfo.isOverdue ? 'font-bold text-[#dc2626]' : 'text-[#888888]'}`}>
                      {timeInfo.countdown}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onCall(callback.orderId)}
                  className="whitespace-nowrap rounded-md bg-[#f07020] px-2 py-1 text-[9px] font-bold text-white transition hover:bg-[#d96500]"
                >
                  Call
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function getTimeInfo(scheduledTime: string | null) {
  if (!scheduledTime) {
    return { isOverdue: false, timeText: '--', countdown: '' }
  }

  const now = new Date()
  const scheduled = new Date(scheduledTime)
  const diffMs = scheduled.getTime() - now.getTime()
  const diffMins = Math.floor(Math.abs(diffMs) / 60000)
  const isOverdue = diffMs < 0
  const hours = Math.floor(diffMins / 60)
  const minutes = diffMins % 60

  return {
    isOverdue,
    timeText: scheduled.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    countdown: isOverdue
      ? `overdue ${diffMins}m`
      : hours > 0
        ? `in ${hours}h ${minutes}m`
        : `in ${minutes}m`
  }
}

function KpiCard({
  label,
  value,
  color,
  delta,
  progress,
  circularValue,
}: {
  label: string
  value: string | number
  color: string
  delta: number
  progress?: number
  circularValue?: number
}) {
  return (
    <Card className="relative overflow-hidden rounded-[10px] border border-[#e5e5e5] bg-white py-0 shadow-none transition-all duration-150 hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
      <div className="h-[3px]" style={{ backgroundColor: color }} />
      <div className="h-[6px] opacity-10" style={{ backgroundColor: color }} />
      <CardContent className="px-5 py-4">
        {typeof circularValue === 'number' ? (
          <div className="flex items-center gap-3">
            <CircularProgress value={circularValue} />
            <div>
              <div className="flex items-center gap-2">
                <div className="text-[26px] font-bold text-[#111111]">{value}</div>
                <DeltaBadge change={delta} />
              </div>
              <div className="text-[11px] text-[#666666]">{label}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="text-[26px] font-bold text-[#111111]">{value}</div>
              <DeltaBadge change={delta} />
            </div>
            <div className="mt-1 text-[11px] text-[#666666]">{label}</div>
            {typeof progress === 'number' ? (
              <div className="mt-3 h-[4px] w-full rounded-full bg-[#f0f0f0]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, backgroundColor: color }}
                />
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ComparisonRow({
  label,
  today,
  yesterday,
  change
}: {
  label: string
  today: string | number
  yesterday: string | number
  change: number
}) {
  const positive = change >= 0
  const Icon = positive ? ArrowUpRight : ArrowDownRight
  const color = positive ? 'text-[#16a34a]' : 'text-[#dc2626]'

  return (
    <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.9fr] items-center border-b border-[#f0f0f0] py-3 text-[12px] last:border-b-0">
      <div className="font-medium text-[#111111]">{label}</div>
      <div className="text-[#111111]">{today}</div>
      <div className="text-[#666666]">{yesterday}</div>
      <div className={`flex items-center justify-end gap-1 font-semibold ${color}`}>
        <Icon className="h-4 w-4" />
        {Math.abs(change)}%
      </div>
    </div>
  )
}

function MetricLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#f0f0f0] bg-[#fcfcfc] px-4 py-3">
      <div className="text-[#666666]">{label}</div>
      <div className="font-semibold text-[#111111]">{value}</div>
    </div>
  )
}

function DeltaBadge({ change }: { change: number }) {
  if (change === 0) {
    return <span className="rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[9px] font-bold text-[#888888]">0%</span>
  }

  const positive = change > 0
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
      style={{
        backgroundColor: positive ? '#f0fdf4' : '#fef2f2',
        color: positive ? '#16a34a' : '#dc2626'
      }}
    >
      {positive ? '+' : '-'}{Math.abs(change)}%
    </span>
  )
}

function CircularProgress({ value }: { value: number }) {
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - value / 100)

  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
      <circle cx="24" cy="24" r={radius} fill="none" stroke="#f0f0f0" strokeWidth="4" />
      <circle
        cx="24"
        cy="24"
        r={radius}
        fill="none"
        stroke="#f07020"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 24 24)"
        className="transition-all duration-700"
      />
      <text x="24" y="24" textAnchor="middle" dominantBaseline="central" className="fill-[#111111] text-[11px] font-bold">
        {value}%
      </text>
    </svg>
  )
}
