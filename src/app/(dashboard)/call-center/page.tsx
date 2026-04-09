'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { ActiveCallPanel } from '@/components/call-center/ActiveCallPanel'
import { CallButton } from '@/components/call-center/CallButton'
import { SoftphoneProvider, useSoftphone } from '@/components/call-center/SoftphoneProvider'
import { useUser } from '@/hooks/use-user'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Clock3,
  Loader2,
  Package2,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Printer,
  RefreshCcw,
  X,
  XCircle,
} from 'lucide-react'
import PusherClient from 'pusher-js'
import { toast } from 'sonner'

const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || ''
const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu'
const DAILY_TARGET = 56

let pusher: PusherClient | null = null
if (typeof window !== 'undefined' && pusherKey) {
  pusher = new PusherClient(pusherKey, {
    cluster: pusherCluster,
    channelAuthorization: {
      endpoint: '/api/pusher/auth',
      transport: 'ajax',
    },
  })
}

interface CallLogEntry {
  id: string
  attempt: string
  createdAt: string
}

interface Order {
  id: string
  trackingNumber: string
  customerName: string
  customerPhone: string
  customerAddress: string
  city: string
  productName: string
  productDescription?: string
  quantity: number
  codAmount: number
  status: string
  notes: string | null
  createdAt: string
  scheduledCallAt: string | null
  callLogs: CallLogEntry[]
  sellerName?: string
  isBundle: boolean
  bundleGroupId: string | null
  itemNames: string[]
  itemCount: number
  isBlacklisted: boolean
  isPriority: boolean
  _score: number
}

interface CallLog {
  id: string
  orderId: string
  orderTracking: string
  customerName: string
  attempt: string
  comment: string | null
  createdAt: string
}

const statusConfig: Record<string, { label: string; badge: string }> = {
  NEW: { label: 'New', badge: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]' },
  CONFIRMED: { label: 'Confirmed', badge: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]' },
  CANCELLED: { label: 'Cancelled', badge: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]' },
  POSTPONED: { label: 'Postponed', badge: 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]' },
  NO_ANSWER: { label: 'No Answer', badge: 'border-[#ffe0b8] bg-[#fff4e6] text-[#c55a00]' },
  BUSY: { label: 'Busy', badge: 'border-[#ffe0b8] bg-[#fff4e6] text-[#c55a00]' },
  CALLBACK: { label: 'Callback', badge: 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]' },
  UNREACHED: { label: 'Unreachable', badge: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]' },
  WRONG_NUMBER: { label: 'Wrong Number', badge: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]' },
  DOUBLE: { label: 'Duplicate', badge: 'border-[#e5e5e5] bg-[#f8f8f8] text-[#888888]' },
  RETURN_TO_STOCK: { label: 'Return to Stock', badge: 'border-[#ffe0b8] bg-[#fff4e6] text-[#c55a00]' },
}

function formatCurrency(value: number) {
  return `FCFA ${Math.round(value).toLocaleString('fr-FR')}`
}

function formatDateShort(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseSelectedDate(value: string) {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function formatTimeDisplay(value: string) {
  if (!value) return 'Select time'
  const [hoursString, minutesString] = value.split(':')
  const hours = Number(hoursString)
  const minutes = Number(minutesString)
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const normalizedHours = hours % 12 || 12
  return `${normalizedHours}:${minutes.toString().padStart(2, '0')} ${suffix}`
}

const TIME_OPTIONS = Array.from({ length: 29 }, (_, index) => {
  const hour = 7 + Math.floor(index / 2)
  const minute = index % 2 === 0 ? '00' : '30'
  const value = `${hour.toString().padStart(2, '0')}:${minute}`
  return {
    value,
    label: formatTimeDisplay(value),
  }
})

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

async function getErrorMessage(response: Response) {
  try {
    const data = await response.json()
    return data?.error || 'Request failed'
  } catch {
    return 'Request failed'
  }
}

function broadcastAgentStats(stats: { totalCalls: number; confirmed: number; cancelled: number }) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('agent-stats-updated', { detail: stats }))
}

function Workspace(_props: {
  userName: string
  orders: Order[]
  callLogs: CallLog[]
  stats: { totalCalls: number; confirmed: number; cancelled: number }
  selectedOrder: Order | null
  loading: boolean
  submitting: boolean
  submittingExpense: boolean
  callNotes: string
  callScheduleDate: string
  callScheduleTime: string
  expenseCategory: string
  expenseAmount: string
  expenseDescription: string
  activeView: 'queue' | 'expense'
  showBundleConfirmDialog: boolean
  bundleConfirming: boolean
  onRefresh: () => void
  onSelectOrder: (order: Order) => void
  onChangeNotes: (value: string) => void
  onChangeScheduleDate: (value: string) => void
  onChangeScheduleTime: (value: string) => void
  onChangeExpenseCategory: (value: string) => void
  onChangeExpenseAmount: (value: string) => void
  onChangeExpenseDescription: (value: string) => void
  onChangeView: (view: 'queue' | 'expense') => void
  onConfirm: () => void
  onNoAnswer: () => void
  onBusy: () => void
  onCallback: () => void
  onCancel: () => void
  onSaveExpense: () => void
  onToggleBundleDialog: (open: boolean) => void
  onConfirmBundle: () => void
}) {
  const {
    userName,
    orders,
    callLogs,
    stats,
    selectedOrder,
    loading,
    submitting,
    submittingExpense,
    callNotes,
    callScheduleDate,
    callScheduleTime,
    expenseCategory,
    expenseAmount,
    expenseDescription,
    activeView,
    showBundleConfirmDialog,
    bundleConfirming,
    onRefresh,
    onSelectOrder,
    onChangeNotes,
    onChangeScheduleDate,
    onChangeScheduleTime,
    onChangeExpenseCategory,
    onChangeExpenseAmount,
    onChangeExpenseDescription,
    onChangeView,
    onConfirm,
    onNoAnswer,
    onBusy,
    onCallback,
    onCancel,
    onSaveExpense,
    onToggleBundleDialog,
    onConfirmBundle,
  } = _props
  const { callStatus } = useSoftphone()
  const priorityOrders = useMemo(
    () => orders.filter((order) => order.isPriority),
    [orders]
  )
  const regularOrders = useMemo(
    () => orders.filter((order) => !priorityOrders.some((priorityOrder) => priorityOrder.id === order.id)),
    [orders, priorityOrders]
  )
  const confirmRate = stats.confirmed + stats.cancelled > 0
    ? Math.round((stats.confirmed / (stats.confirmed + stats.cancelled)) * 100)
    : 0
  const progress = Math.min(100, Math.round((stats.totalCalls / DAILY_TARGET) * 100))

  const handlePrint = useCallback(() => {
    if (!selectedOrder) return

    const printWindow = window.open('', '_blank', 'width=420,height=700')
    if (!printWindow) {
      toast.error('Unable to open print window')
      return
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Label</title>
          <style>
            @page { size: 102mm 152mm; margin: 0; }
            body { margin: 0; font-family: Arial, sans-serif; background: white; }
            .page { width: 102mm; height: 152mm; box-sizing: border-box; padding: 6mm; display: flex; flex-direction: column; }
            .tracking { font-size: 24px; font-weight: 700; text-align: center; border-bottom: 2px solid #000; padding-bottom: 3mm; margin-bottom: 4mm; }
            .label { font-size: 12px; color: #555; margin-bottom: 1mm; }
            .value { font-size: 16px; font-weight: 700; margin-bottom: 3mm; }
            .divider { border-bottom: 1px dashed #000; margin: 3mm 0; }
            .cod { margin-top: auto; text-align: center; }
            .cod .label { font-size: 14px; color: #000; font-weight: 700; }
            .cod .value { font-size: 28px; margin-bottom: 4mm; }
            .signature { height: 15mm; border: 1px solid #000; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="tracking">${selectedOrder.trackingNumber}</div>
            <div class="label">Customer</div>
            <div class="value">${selectedOrder.customerName}</div>
            <div class="label">Phone</div>
            <div class="value">${selectedOrder.customerPhone}</div>
            <div class="label">Address</div>
            <div class="value">${selectedOrder.customerAddress}, ${selectedOrder.city}</div>
            <div class="divider"></div>
            <div class="label">Product</div>
            <div class="value">${selectedOrder.productName} (x${selectedOrder.quantity})</div>
            <div class="label">Seller</div>
            <div class="value">${selectedOrder.sellerName || 'Unknown seller'}</div>
            <div class="divider"></div>
            <div class="cod">
              <div class="label">COD Amount</div>
              <div class="value">${formatCurrency(selectedOrder.codAmount)}</div>
              <div class="label">Signature</div>
              <div class="signature"></div>
            </div>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }, [selectedOrder])

  const renderQueueCard = (order: Order, priority: boolean) => (
    <button
      key={order.id}
      id={`queue-card-${order.id}`}
      type="button"
      onClick={() => onSelectOrder(order)}
      className={cn(
        'w-full rounded-[10px] border px-3 py-3 text-left transition',
        priority ? 'border-[#ffe0c0] bg-[#fffcf5]' : 'border-[#e5e5e5] bg-white',
        order.isBlacklisted && 'border-[#fecaca] bg-[#fff8f8]',
        selectedOrder?.id === order.id
          ? 'border-[#f07020] shadow-[0_0_0_3px_rgba(240,112,32,0.1)]'
          : 'hover:border-[rgba(240,112,32,0.22)] hover:shadow-[0_1px_6px_rgba(240,112,32,0.08)]'
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#f07020] text-[10px] font-bold text-white">
          {initials(order.customerName)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold text-[#111111]">{order.customerName}</div>
          <div className="truncate text-[9.5px] text-[#888888]">{order.trackingNumber}</div>
        </div>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {priority && <Badge className="rounded-full border border-[#ffe0c0] bg-[#fff4e8] px-2 py-0 text-[8px] font-bold text-[#b85000]">Priority</Badge>}
        {order.isBundle && <Badge className="rounded-full border border-[#ede9fe] bg-[#f5f3ff] px-2 py-0 text-[8px] font-bold text-[#6d28d9]">Bundle</Badge>}
        {order.isBlacklisted && <Badge className="rounded-full border border-[#fecaca] bg-[#fef2f2] px-2 py-0 text-[8px] font-bold text-[#dc2626]">Blacklisted</Badge>}
        {order.status === 'NEW' && <Badge className="rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-0 text-[8px] font-bold text-[#15803d]">New</Badge>}
        {order.sellerName && <Badge className="rounded-full border border-[#e5e5e5] bg-[#f8f8f8] px-2 py-0 text-[8px] font-bold text-[#888888]">{order.sellerName}</Badge>}
      </div>
      {order.scheduledCallAt ? (
        <div className="mb-2 flex items-center gap-1 text-[9px] font-medium text-[#f07020]">
          <Clock3 className="h-[9px] w-[9px]" />
          Scheduled: {format(new Date(order.scheduledCallAt), 'MMM d, h:mm a')}
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-bold text-[#f07020]">{formatCurrency(order.codAmount)}</div>
        <div className="flex items-center gap-1 text-[9px] text-[#888888]"><Phone className="h-[9px] w-[9px]" />{order.callLogs.length} attempts</div>
      </div>
    </button>
  )

  return (
    <div className="flex flex-col overflow-hidden bg-[#f8f8f8] font-sora" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* ── VIEW TOGGLE + KPI ── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[#e5e5e5] bg-white px-4 py-2">
        <button type="button" onClick={() => onChangeView('queue')} className={cn('rounded-lg px-3 py-1.5 text-[11px] font-bold transition', activeView === 'queue' ? 'bg-[#f07020] text-white shadow-sm' : 'text-[#888] hover:bg-[#f4f4f5]')}>
          Call Queue <span className="ml-1 text-[9px]">({orders.length})</span>
        </button>
        <button type="button" onClick={() => onChangeView('expense')} className={cn('rounded-lg px-3 py-1.5 text-[11px] font-bold transition', activeView === 'expense' ? 'bg-[#f07020] text-white shadow-sm' : 'text-[#888] hover:bg-[#f4f4f5]')}>
          Log Expense
        </button>
        <div className="ml-auto flex items-center gap-3 text-[10px]">
          <span className="text-[#555]">Calls: <strong className="text-[#f07020]">{stats.totalCalls}/{DAILY_TARGET}</strong></span>
          <span className="text-[#555]">Confirmed: <strong className="text-[#16a34a]">{stats.confirmed}</strong></span>
          <span className="text-[#555]">Cancelled: <strong className="text-[#dc2626]">{stats.cancelled}</strong></span>
          <span className="text-[#555]">Rate: <strong className="text-[#111]">{confirmRate}%</strong></span>
          <button type="button" onClick={onRefresh} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white text-[#555] transition hover:bg-[#f9f9f9]">{loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}</button>
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {activeView === 'queue' && callStatus !== 'idle' && selectedOrder && (
            <div className="border-b border-[#e5e5e5] bg-white px-4 py-2">
              <ActiveCallPanel customerName={selectedOrder.customerName} phone={selectedOrder.customerPhone} orderCode={selectedOrder.trackingNumber} />
            </div>
          )}

          <div className={cn('flex min-h-0 flex-1 overflow-hidden', activeView !== 'queue' && 'hidden')}>
            <div className="flex w-[296px] shrink-0 flex-col border-r border-[#e5e5e5] bg-white">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] px-[14px] py-[10px]">
                <div>
                  <div className="text-[12.5px] font-bold text-[#111111]">Call Queue ({orders.length})</div>
                  <div className="text-[10px] text-[#555555]">Orders pending confirmation</div>
                </div>
                <span className="rounded-full border border-[#ffe0c0] bg-[#fff4e8] px-[9px] py-[3px] text-[9px] font-bold text-[#b85000]">{orders.length} orders</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#d4d4d4_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#d4d4d4] [&::-webkit-scrollbar-track]:bg-transparent">
                <div id="priority-queue-section" className="sticky top-0 z-10 flex items-center gap-[6px] border-b border-[#e5e5e5] bg-[#f8f8f8] px-[13px] py-[7px] text-[9.5px] font-bold text-[#b85000]">
                  <PhoneIncoming className="h-[10px] w-[10px]" />
                  Priority Queue
                  <span className="ml-1 rounded-full bg-[#fff4e8] px-[7px] py-[1.5px] text-[8.5px] text-[#b85000]">{priorityOrders.length}</span>
                </div>
                <div className="flex flex-col gap-[6px] p-2">{priorityOrders.map((order) => renderQueueCard(order, true))}</div>
                <div className="sticky top-[28px] z-10 flex items-center gap-[6px] border-b border-[#e5e5e5] bg-[#f8f8f8] px-[13px] py-[7px] text-[9.5px] font-bold text-[#555555]">
                  <Circle className="h-[10px] w-[10px]" />
                  Regular Queue
                  <span className="ml-1 rounded-full bg-[#f1f5f9] px-[7px] py-[1.5px] text-[8.5px] text-[#52525b]">{regularOrders.length}</span>
                </div>
                <div className="flex flex-col gap-[6px] p-2">{regularOrders.map((order) => renderQueueCard(order, false))}</div>
              </div>
            </div>

            <div id="call-center-detail-panel" className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
              {!selectedOrder ? (
                <div className="flex h-full flex-col items-center justify-center gap-2">
                  <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-dashed border-[rgba(240,112,32,0.2)]">
                    <Phone className="h-6 w-6 text-[rgba(240,112,32,0.4)]" />
                  </div>
                  <div className="text-[13px] font-bold text-[#111111]">Select an order to begin</div>
                  <div className="text-center text-[11px] leading-[1.7] text-[#888888]">Click any order from the queue<br />to view details and take action</div>
                </div>
              ) : (
                <>
                  <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-[14px]">
                    {selectedOrder.isBlacklisted && (
                      <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-red-900 text-sm">Blacklisted Number</div>
                          <div className="text-xs text-red-700">
                            This number has poor order history. Proceed with caution.
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="mb-[11px] flex items-center gap-[11px] border-b border-[#e5e5e5] pb-3">
                      <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-[#f07020] text-[15px] font-bold text-white">{initials(selectedOrder.customerName)}</div>
                      <div>
                        <div className="text-[14px] font-bold text-[#111111]">{selectedOrder.customerName}</div>
                        <div className="mt-[2px] text-[11.5px] text-[#555555]">{selectedOrder.customerPhone} · {selectedOrder.city}</div>
                        <div className="mt-[7px] flex flex-wrap gap-[5px]">
                          {(selectedOrder.isBlacklisted || selectedOrder.isBundle) && <Badge className="rounded-full border border-[#ffe0c0] bg-[#fff4e8] px-2 py-0 text-[8px] font-bold text-[#b85000]">Priority</Badge>}
                          <Badge className="rounded-full border border-[#e5e5e5] bg-[#f8f8f8] px-2 py-0 text-[8px] font-bold text-[#888888]">{selectedOrder.trackingNumber}</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="mb-[11px] rounded-[10px] border border-[#e5e5e5] bg-[#f8f8f8] px-[13px] py-[11px]">
                      <div className="mb-2 flex items-center gap-[5px] text-[9.5px] font-bold uppercase tracking-[0.6px] text-[#555555]"><Circle className="h-[10px] w-[10px]" />Order Details</div>
                      <div className="grid grid-cols-2 gap-[7px]">
                        <div><div className="text-[9px] text-[#888888]">CCD Amount</div><div className="text-[16px] font-extrabold text-[#f07020]">{formatCurrency(selectedOrder.codAmount)}</div></div>
                        <div><div className="text-[9px] text-[#888888]">Tracking</div><div className="text-[12px] font-semibold text-[#111111]">{selectedOrder.trackingNumber}</div></div>
                        <div><div className="text-[9px] text-[#888888]">Seller</div><div className="text-[12px] font-semibold text-[#111111]">{selectedOrder.sellerName || 'Unknown seller'}</div></div>
                        <div><div className="text-[9px] text-[#888888]">Address</div><div className="text-[12px] font-semibold text-[#111111]">{selectedOrder.customerAddress}, {selectedOrder.city}</div></div>
                      </div>
                    </div>

                    <div className="mb-[11px] rounded-[10px] border border-[#e5e5e5] bg-[#f8f8f8] px-3 py-[10px]">
                      <div className="flex items-center gap-[10px]">
                        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#fff4e8] text-[#f07020]"><Package2 className="h-4 w-4" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-semibold text-[#111111]">{selectedOrder.productName}</div>
                          <div className="text-[10.5px] text-[#555555]">{selectedOrder.sellerName || 'Seller unavailable'} &middot; Qty: {selectedOrder.quantity}</div>
                        </div>
                      </div>
                      {selectedOrder.itemCount > 1 && (
                        <div className="mt-2 border-t border-[#e5e5e5] pt-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.5px] text-[#888888]">Bundle Items ({selectedOrder.itemCount})</div>
                          {selectedOrder.itemNames.map((name, i) => (
                            <div key={i} className="mt-1 flex items-center gap-1 text-[10.5px] text-[#555555]">
                              <span className="h-[4px] w-[4px] rounded-full bg-[#f07020]" />
                              {name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Call Button */}
                    <div className="mb-[11px]">
                      <CallButton phone={selectedOrder.customerPhone} />
                    </div>

                    <div className="rounded-[10px] border border-[#e5e5e5] bg-[#f8f8f8] px-[13px] py-[11px]">
                      <div className="mb-2 flex items-center gap-[5px] text-[9.5px] font-bold uppercase tracking-[0.6px] text-[#555555]"><Phone className="h-[10px] w-[10px]" />Call History</div>
                      {selectedOrder.callLogs.length === 0 ? <div className="text-[11px] text-[#888888]">No call attempts yet</div> : selectedOrder.callLogs.slice(0, 5).map((log) => (
                        <div key={log.id} className="flex items-center gap-2 border-b border-[#e5e5e5] py-[5px] last:border-b-0">
                          <span className="h-[7px] w-[7px] rounded-full bg-[#f07020]" />
                          <span className="flex-1 text-[11px] text-[#111111]">{statusConfig[log.attempt]?.label || log.attempt}</span>
                          <span className="text-[9.5px] text-[#888888]">{formatTime(log.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-[#e5e5e5] bg-white">
                    <div className="grid grid-cols-6 border-b border-[#e5e5e5]">
                      <button type="button" onClick={onConfirm} disabled={submitting || callStatus !== 'idle'} className="relative border-r border-[#e5e5e5] bg-white px-1 py-[9px] text-center hover:bg-[#f8f8f8] disabled:opacity-60"><div className="absolute left-0 right-0 top-0 h-[2.5px] bg-[#16a34a]" /><div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#f0fdf4] text-[#16a34a]"><Check className="h-[13px] w-[13px]" /></div><div className="text-[9px] font-bold text-[#111111]">Confirm</div><div className="text-[7.5px] text-[#888888]">Accept order</div></button>
                      <button type="button" onClick={onNoAnswer} disabled={submitting || callStatus !== 'idle'} className="relative border-r border-[#e5e5e5] bg-white px-1 py-[9px] text-center hover:bg-[#f8f8f8] disabled:opacity-60"><div className="absolute left-0 right-0 top-0 h-[2.5px] bg-[#f07020]" /><div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#fff4e8] text-[#f07020]"><PhoneMissed className="h-[13px] w-[13px]" /></div><div className="text-[9px] font-bold text-[#111111]">No Answer</div><div className="text-[7.5px] text-[#888888]">Log attempt</div></button>
                      <button type="button" onClick={onBusy} disabled={submitting || callStatus !== 'idle'} className="relative border-r border-[#e5e5e5] bg-white px-1 py-[9px] text-center hover:bg-[#f8f8f8] disabled:opacity-60"><div className="absolute left-0 right-0 top-0 h-[2.5px] bg-[#d96500]" /><div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#fff4e8] text-[#d96500]"><PhoneOff className="h-[13px] w-[13px]" /></div><div className="text-[9px] font-bold text-[#111111]">Busy</div><div className="text-[7.5px] text-[#888888]">Line busy</div></button>
                      <button type="button" onClick={onCallback} disabled={submitting || !callScheduleDate || !callScheduleTime} className="relative border-r border-[#e5e5e5] bg-white px-1 py-[9px] text-center hover:bg-[#f8f8f8] disabled:opacity-60"><div className="absolute left-0 right-0 top-0 h-[2.5px] bg-[#f59e0b]" /><div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#fffbeb] text-[#d97706]"><Clock3 className="h-[13px] w-[13px]" /></div><div className="text-[9px] font-bold text-[#111111]">Callback</div><div className="text-[7.5px] text-[#888888]">Schedule later</div></button>
                      <button type="button" onClick={onCancel} disabled={submitting} className="relative border-r border-[#e5e5e5] bg-white px-1 py-[9px] text-center hover:bg-[#f8f8f8] disabled:opacity-60"><div className="absolute left-0 right-0 top-0 h-[2.5px] bg-[#dc2626]" /><div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#fef2f2] text-[#dc2626]"><X className="h-[13px] w-[13px]" /></div><div className="text-[9px] font-bold text-[#111111]">Cancel Order</div><div className="text-[7.5px] text-[#888888]">Reject</div></button>
                      <button type="button" onClick={handlePrint} className="relative bg-white px-1 py-[9px] text-center hover:bg-[#f8f8f8]">
                        <div className="absolute left-0 right-0 top-0 h-[2.5px] bg-[#111111]" />
                        <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#f4f4f5] text-[#18181b]"><Printer className="h-[13px] w-[13px]" /></div>
                        <div className="text-[9px] font-bold text-[#111111]">Print Label</div>
                        <div className="text-[7.5px] text-[#888888]">4x6 thermal</div>
                      </button>
                    </div>
                    <div className="grid grid-cols-[60%_40%]">
                      <div className="relative border-r border-[#e5e5e5] px-[14px] py-[10px]">
                        <div className="absolute left-0 right-0 top-0 h-[2.5px] bg-[#f07020]" />
                        <div className="mb-[6px] flex items-center gap-[5px] text-[9px] font-bold uppercase tracking-[0.5px] text-[#555555]"><PhoneCall className="h-[9px] w-[9px]" />Call Notes</div>
                        <div className="grid grid-cols-[1fr_auto] items-end gap-[6px]">
                          <Textarea value={callNotes} onChange={(event) => onChangeNotes(event.target.value)} placeholder="Add notes..." className="h-[46px] resize-none rounded-[8px] border-[#e5e5e5] bg-[#f8f8f8] p-[7px_9px] text-[11px] text-[#111111] focus-visible:ring-[2px] focus-visible:ring-[rgba(240,112,32,0.08)]" />
                          <Button className="h-[32px] rounded-[8px] bg-[#f07020] px-[14px] text-[10px] font-bold text-white hover:bg-[#d96500]">Save</Button>
                        </div>
                      </div>
                      <div className="relative px-[14px] py-[10px]">
                        <div className="absolute left-0 right-0 top-0 h-[2.5px] bg-[#d96500]" />
                        <div className="mb-[6px] flex items-center gap-[5px] text-[9px] font-bold uppercase tracking-[0.5px] text-[#555555]"><Clock3 className="h-[9px] w-[9px]" />Schedule Callback</div>
                        <div className="mb-[5px] grid grid-cols-2 gap-[5px]">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button type="button" className="flex h-[33px] items-center gap-2 rounded-[8px] border border-[#e5e5e5] bg-white px-3 text-[10.5px] font-medium text-[#555555] transition hover:border-[#f07020]">
                                <CalendarDays className="h-[14px] w-[14px] text-[#888888]" />
                                {callScheduleDate ? format(new Date(`${callScheduleDate}T00:00:00`), 'MMM d, yyyy') : 'Select date'}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-auto rounded-xl border-[#e5e5e5] p-0">
                              <Calendar
                                mode="single"
                                selected={parseSelectedDate(callScheduleDate)}
                                onSelect={(value) => onChangeScheduleDate(value ? format(value, 'yyyy-MM-dd') : '')}
                                className="rounded-xl"
                                classNames={{
                                  day_selected: 'bg-[#f07020] text-white hover:bg-[#d96500] focus:bg-[#d96500]',
                                  day_today: 'bg-[#fff4e8] text-[#f07020]'
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button type="button" className="flex h-[33px] items-center gap-2 rounded-[8px] border border-[#e5e5e5] bg-white px-3 text-[10.5px] font-medium text-[#555555] transition hover:border-[#f07020]">
                                <Clock className="h-[14px] w-[14px] text-[#888888]" />
                                {formatTimeDisplay(callScheduleTime)}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-[180px] rounded-xl border-[#e5e5e5] p-1">
                              <div className="max-h-[240px] overflow-y-auto">
                                {TIME_OPTIONS.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => onChangeScheduleTime(option.value)}
                                    className={cn(
                                      'flex w-full items-center rounded-lg px-3 py-2 text-[11px] font-medium transition',
                                      callScheduleTime === option.value
                                        ? 'bg-[#fff4e8] text-[#f07020]'
                                        : 'text-[#555555] hover:bg-[#f8f8f8]'
                                    )}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <Button onClick={onCallback} disabled={submitting || !callScheduleDate || !callScheduleTime} className="h-[32px] w-full rounded-[8px] bg-[#f07020] text-[10px] font-bold text-white hover:bg-[#d96500]">Save Callback</Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

        {/* EXPENSE VIEW (replaces queue when active) */}
        {activeView === 'expense' && (
          <div className="flex flex-1 items-start justify-center overflow-y-auto bg-[#f8f8f8] p-8">
            <div className="w-full max-w-[460px] rounded-[12px] border border-[#e5e5e5] bg-white p-[18px] shadow-sm">
              <div className="mb-4 text-[14px] font-bold text-[#111111]">Log Expense</div>
              <div className="grid gap-[13px]">
                <Select value={expenseCategory} onValueChange={onChangeExpenseCategory}><SelectTrigger className="h-[42px] rounded-[9px] border-[#e5e5e5] text-[12px]"><SelectValue placeholder="Select category..." /></SelectTrigger><SelectContent><SelectItem value="Transport">Transport</SelectItem><SelectItem value="Meals">Meals</SelectItem><SelectItem value="Equipment">Equipment</SelectItem><SelectItem value="Call Minutes">Call Minutes</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select>
                <Input type="number" value={expenseAmount} onChange={(event) => onChangeExpenseAmount(event.target.value)} placeholder="Amount (XAF)" className="h-[42px] rounded-[9px] border-[#e5e5e5] text-[12px]" />
                <Input value={expenseDescription} onChange={(event) => onChangeExpenseDescription(event.target.value)} placeholder="Describe the expense..." className="h-[42px] rounded-[9px] border-[#e5e5e5] text-[12px]" />
                <Button onClick={onSaveExpense} disabled={!expenseCategory || !expenseAmount || submittingExpense} className="h-[42px] rounded-[9px] bg-[#f07020] text-[12.5px] font-bold text-white hover:bg-[#d96500]">{submittingExpense ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Log Expense</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BUNDLE CONFIRM DIALOG */}
      <Dialog open={showBundleConfirmDialog} onOpenChange={onToggleBundleDialog}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Confirm all bundle orders?</DialogTitle>
            <DialogDescription className="text-[12px]">This customer has grouped orders from multiple sellers. Confirm all at once or close and confirm individually.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onToggleBundleDialog(false)} disabled={bundleConfirming}>Close</Button>
            <Button onClick={onConfirmBundle} disabled={bundleConfirming} className="bg-[#16a34a] hover:bg-[#15803d]">{bundleConfirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Confirm All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CallCenterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: userLoading } = useUser()
  const hydratedSelectionRef = useRef<string | null>(null)

  const [orders, setOrders] = useState<Order[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [stats, setStats] = useState({ totalCalls: 0, confirmed: 0, cancelled: 0 })
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedSnapshot, setSelectedSnapshot] = useState<Order | null>(null)
  const [callNotes, setCallNotes] = useState('')
  const [callScheduleDate, setCallScheduleDate] = useState('')
  const [callScheduleTime, setCallScheduleTime] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [activeView, setActiveView] = useState<'queue' | 'expense'>('queue')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submittingExpense, setSubmittingExpense] = useState(false)
  const [showBundleConfirmDialog, setShowBundleConfirmDialog] = useState(false)
  const [bundleConfirming, setBundleConfirming] = useState(false)
  const [currentBundleId, setCurrentBundleId] = useState<string | null>(null)

  useEffect(() => {
    if (userLoading) return
    // ADMIN, SUPER_ADMIN, and CALL_CENTER agents can access this dashboard
    if (user && user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      router.push('/unauthorized')
    }
  }, [user, userLoading, router])

  // Heartbeat: keep agent marked as online
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await fetch('/api/agents/heartbeat', { method: 'POST' })
      } catch (e) {
        // silent fail - don't interrupt user
      }
    }

    sendHeartbeat() // immediate ping on mount
    const interval = setInterval(sendHeartbeat, 30000) // every 30s

    return () => clearInterval(interval)
  }, [])

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [ordersRes, logsRes] = await Promise.all([fetch('/api/orders/priority-queue'), fetch('/api/call-logs')])
      const ordersData = ordersRes.ok ? await ordersRes.json() : null
      const logsData = logsRes.ok ? await logsRes.json() : null
      setOrders(ordersData?.orders || [])
      const nextStats = logsData?.stats || ordersData?.stats || { totalCalls: 0, confirmed: 0, cancelled: 0 }
      setStats(nextStats)
      broadcastAgentStats(nextStats)
      setCallLogs(logsData?.logs || [])
    } catch (error) {
      console.error(error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  useEffect(() => {
    if (!pusher || !user) return
    const channel = pusher.subscribe('queue-updates')
    const refresh = () => fetchData()
    channel.bind('order-updated', refresh)
    channel.bind('order-created', refresh)
    channel.bind('bundle-detected', refresh)
    return () => {
      channel.unbind('order-updated', refresh)
      channel.unbind('order-created', refresh)
      channel.unbind('bundle-detected', refresh)
      pusher?.unsubscribe('queue-updates')
    }
  }, [user, fetchData])

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return selectedSnapshot
    return orders.find((order) => order.id === selectedOrderId) || selectedSnapshot
  }, [orders, selectedOrderId, selectedSnapshot])

  useEffect(() => {
    if (!selectedOrderId) return
    const live = orders.find((order) => order.id === selectedOrderId)
    if (live) setSelectedSnapshot(live)
  }, [orders, selectedOrderId])

  const selectOrder = useCallback((order: Order) => {
    setSelectedOrderId(order.id)
    setSelectedSnapshot(order)
    setCallNotes(order.notes || '')
    setCallScheduleDate('')
    setCallScheduleTime('')
    requestAnimationFrame(() => {
      document.getElementById('call-center-detail-panel')?.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }, [])

  const runCallCenterAction = useCallback(async (
    orderId: string,
    action: 'CONFIRM' | 'NO_ANSWER' | 'BUSY' | 'CALLBACK' | 'CANCEL',
    extras?: Record<string, unknown>
  ) => {
    const response = await fetch('/api/call-center/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, action, note: callNotes, ...extras })
    })
    if (!response.ok) throw new Error(await getErrorMessage(response))
  }, [callNotes])

  const removeFromQueue = useCallback((orderId: string) => {
    setOrders((current) => current.filter((order) => order.id !== orderId))
  }, [])

  const updateSnapshot = useCallback((patch: Partial<Order>) => {
    setSelectedSnapshot((current) => (current ? { ...current, ...patch } : current))
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!selectedOrder) return
    if (selectedOrder.bundleGroupId) {
      setCurrentBundleId(selectedOrder.bundleGroupId)
      setShowBundleConfirmDialog(true)
      return
    }
    setSubmitting(true)
    try {
      await runCallCenterAction(selectedOrder.id, 'CONFIRM')
      removeFromQueue(selectedOrder.id)
      updateSnapshot({ status: 'CONFIRMED' })
      toast.success(`${selectedOrder.trackingNumber} confirmed`)
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to confirm order')
    } finally {
      setSubmitting(false)
    }
  }, [fetchData, removeFromQueue, runCallCenterAction, selectedOrder, updateSnapshot])

  const handleNoAnswer = useCallback(async () => {
    if (!selectedOrder) return
    setSubmitting(true)
    try {
      await runCallCenterAction(selectedOrder.id, 'NO_ANSWER')
      toast.success('No answer logged')
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to log attempt')
    } finally {
      setSubmitting(false)
    }
  }, [fetchData, runCallCenterAction, selectedOrder])

  const handleBusy = useCallback(async () => {
    if (!selectedOrder) return
    setSubmitting(true)
    try {
      await runCallCenterAction(selectedOrder.id, 'BUSY')
      toast.success('Busy logged')
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to log attempt')
    } finally {
      setSubmitting(false)
    }
  }, [fetchData, runCallCenterAction, selectedOrder])

  const handleCallback = useCallback(async () => {
    if (!selectedOrder || !callScheduleDate || !callScheduleTime) return
    setSubmitting(true)
    try {
      const scheduledAt = new Date(`${callScheduleDate}T${callScheduleTime}`)
      await runCallCenterAction(selectedOrder.id, 'CALLBACK', { scheduledCallAt: scheduledAt.toISOString() })
      updateSnapshot({ status: 'CALLBACK', scheduledCallAt: scheduledAt.toISOString() })
      toast.success(`Callback saved: ${format(scheduledAt, 'MMM d, yyyy')} at ${format(scheduledAt, 'h:mm a')}`)
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to schedule callback')
    } finally {
      setSubmitting(false)
    }
  }, [callScheduleDate, callScheduleTime, fetchData, runCallCenterAction, selectedOrder, updateSnapshot])

  const handleCancel = useCallback(async () => {
    if (!selectedOrder) return
    setSubmitting(true)
    try {
      await runCallCenterAction(selectedOrder.id, 'CANCEL')
      removeFromQueue(selectedOrder.id)
      updateSnapshot({ status: 'CANCELLED' })
      toast.success(`${selectedOrder.trackingNumber} cancelled`)
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel order')
    } finally {
      setSubmitting(false)
    }
  }, [fetchData, removeFromQueue, runCallCenterAction, selectedOrder, updateSnapshot])

  const handleConfirmBundle = useCallback(async () => {
    if (!currentBundleId) return
    setBundleConfirming(true)
    try {
      const response = await fetch('/api/orders/bundle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bundleId: currentBundleId }) })
      if (!response.ok) throw new Error(await getErrorMessage(response))
      if (selectedOrder) removeFromQueue(selectedOrder.id)
      setShowBundleConfirmDialog(false)
      setCurrentBundleId(null)
      toast.success('Bundle confirmed')
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to confirm bundle')
    } finally {
      setBundleConfirming(false)
    }
  }, [currentBundleId, fetchData, removeFromQueue, selectedOrder])

  const handleSaveExpense = useCallback(async () => {
    if (!expenseCategory || !expenseAmount) return
    setSubmittingExpense(true)
    try {
      const response = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: expenseCategory, amount: expenseAmount, description: expenseDescription }) })
      if (!response.ok) throw new Error(await getErrorMessage(response))
      setExpenseCategory('')
      setExpenseAmount('')
      setExpenseDescription('')
      toast.success('Expense logged')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to log expense')
    } finally {
      setSubmittingExpense(false)
    }
  }, [expenseAmount, expenseCategory, expenseDescription])

  useEffect(() => {
    const selectedId = searchParams.get('select')
    if (!selectedId || hydratedSelectionRef.current === selectedId || orders.length === 0) return

    const match = orders.find((order) => order.id === selectedId)
    if (!match) return

    hydratedSelectionRef.current = selectedId
    selectOrder(match)

    requestAnimationFrame(() => {
      document.getElementById(`queue-card-${selectedId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }, [orders, searchParams, selectOrder])

  useEffect(() => {
    if (searchParams.get('section') !== 'priority') return
    requestAnimationFrame(() => {
      document.getElementById('priority-queue-section')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }, [searchParams])

  if (userLoading || (loading && !orders.length && !selectedOrder)) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#f07020]" /></div>
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'CALL_CENTER')) return null

  return (
    <>
      <SoftphoneProvider>
          <Workspace
            userName={user.name || 'Agent 1'}
            orders={orders}
            callLogs={callLogs}
            stats={stats}
            selectedOrder={selectedOrder}
            loading={loading}
            submitting={submitting}
            submittingExpense={submittingExpense}
            callNotes={callNotes}
            callScheduleDate={callScheduleDate}
            callScheduleTime={callScheduleTime}
            expenseCategory={expenseCategory}
            expenseAmount={expenseAmount}
            expenseDescription={expenseDescription}
            activeView={activeView}
            showBundleConfirmDialog={showBundleConfirmDialog}
            bundleConfirming={bundleConfirming}
            onRefresh={fetchData}
            onSelectOrder={selectOrder}
            onChangeNotes={setCallNotes}
            onChangeScheduleDate={setCallScheduleDate}
            onChangeScheduleTime={setCallScheduleTime}
            onChangeExpenseCategory={setExpenseCategory}
            onChangeExpenseAmount={setExpenseAmount}
            onChangeExpenseDescription={setExpenseDescription}
            onChangeView={setActiveView}
            onConfirm={handleConfirm}
            onNoAnswer={handleNoAnswer}
            onBusy={handleBusy}
            onCallback={handleCallback}
            onCancel={handleCancel}
            onSaveExpense={handleSaveExpense}
            onToggleBundleDialog={setShowBundleConfirmDialog}
            onConfirmBundle={handleConfirmBundle}
          />
      </SoftphoneProvider>
    </>
  )
}

export default function CallCenterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#f07020]" /></div>}>
      <CallCenterPageContent />
    </Suspense>
  )
}
