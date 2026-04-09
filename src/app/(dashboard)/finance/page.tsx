'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useUser } from '@/hooks/use-user'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCcw,
  Download,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Phone,
  Truck,
  Lock,
  Plus,
  BarChart3,
  Settings,
  Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
interface FinancialStats {
  revenue: number
  expenses: number
  netProfit: number
  pendingWithdrawals: number
  orderCount: number
}

interface Transaction {
  id: string
  type: string
  amount: number
  description: string
  createdAt: string
  orderId?: string | null
  wallet?: {
    seller: {
      id: string
      name: string
      email: string
    }
  }
}

interface Withdrawal {
  id: string
  amount: number
  method: string
  account: string | null
  status: string
  requestedAt: string
  processedAt: string | null
  note: string | null
  wallet: {
    seller: {
      id: string
      name: string
      email: string
    }
  }
}

interface Invoice {
  id: string
  ref: string
  cycleType: string
  cashCollected: number
  totalNet: number
  status: string
  dateFrom: string
  dateTo: string
  isLocked: boolean
  seller?: { id: string; name: string }
  deliveryMan?: { id: string; name: string }
}

interface SellerFinancial {
  sellerId: string
  sellerName: string
  sellerEmail: string
  revenue: number
  expenses: number
  fees: number
  netProfit: number
  walletBalance: number
  orderCount?: number
}

interface Wallet {
  id: string
  sellerId: string
  seller: {
    id: string
    name: string
    email: string
  }
  balance: number
  totalEarned: number
  totalDeducted: number
}

interface RemittanceLock {
  id: string
  deliveryManId: string
  deliveryMan: { id: string; name: string }
  periodStart: string
  periodEnd: string
  cashCollected: number
  deliveryCount: number
  totalFees: number
  netDue: number
  status: string
  lockedAt: string
}

interface ChartData {
  date: string
  revenue: number
  expenses: number
}

export default function FinanceTabPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [bySeller, setBySeller] = useState<SellerFinancial[]>([])
  const [remittanceLocks, setRemittanceLocks] = useState<RemittanceLock[]>([])
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('30d')
  const [deliveryMen, setDeliveryMen] = useState<{ id: string; name: string }[]>([])
  const [callCenterAgents, setCallCenterAgents] = useState<{ id: string; name: string }[]>([])
  // Agent fees form state
  const [agentId, setAgentId] = useState('')
  const [agentExpenseType, setAgentExpenseType] = useState('')
  const [agentAmount, setAgentAmount] = useState('')
  const [agentDescription, setAgentDescription] = useState('')
  const [agentExpenses, setAgentExpenses] = useState<{ id: string; createdAt: string; category: string; amount: number; description: string | null; agentId: string | null; agent?: { name: string } | null }[]>([])
  const [deliveryPerf, setDeliveryPerf] = useState<{ id: string; name: string; delivered: number; returned: number; cancelled: number; postponed: number; inProgress: number; totalCashCollected: number; deliveryRate: string; avgDeliveriesPerDay: string }[]>([])

  // Selected wallet for seller wallets tab
  const [selectedWalletIndex, setSelectedWalletIndex] = useState(0)

  // Withdrawal request dialog
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false)
  const [withdrawalAmount, setWithdrawalAmount] = useState('')

  // Add expense dialog
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false)
  const [expenseCategory, setExpenseCategory] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseSellerId, setExpenseSellerId] = useState('')

  // Remittance lock form
  const [remDriver, setRemDriver] = useState('')
  const [remStartDate, setRemStartDate] = useState('')
  const [remEndDate, setRemEndDate] = useState('')

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'ok' | 'no' } | null>(null)

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    }
  }, [user, userLoading, router])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user, period])

  const fetchData = async () => {
    if (!user) return

    setLoading(true)
    try {
      // Fetch stats
      const statsRes = await fetch(`/api/finance?period=${period}`)
      if (statsRes.ok) {
        setStats(await statsRes.json())
      }

      // Fetch transactions
      const txRes = await fetch(`/api/finance/transactions?period=${period}`)
      if (txRes.ok) {
        setTransactions(await txRes.json())
      }

      // Fetch withdrawals
      const wdRes = await fetch(`/api/finance/withdrawals`)
      if (wdRes.ok) {
        setWithdrawals(await wdRes.json())
      }

      // Fetch invoices
      const invRes = await fetch(`/api/finance/invoices`)
      if (invRes.ok) {
        setInvoices(await invRes.json())
      }

      // Fetch wallets
      const walRes = await fetch('/api/wallet/all')
      if (walRes.ok) {
        const data = await walRes.json()
        setWallets(data.wallets || [])
      }

      // Fetch by-seller data (admin only)
      if (user.role !== 'SELLER') {
        const bsRes = await fetch(`/api/finance?type=by-seller&period=${period}`)
        if (bsRes.ok) {
          setBySeller(await bsRes.json())
        }

        // Fetch remittance locks
        const remRes = await fetch('/api/finance/remittance')
        if (remRes.ok) {
          const remData = await remRes.json()
          setRemittanceLocks(Array.isArray(remData) ? remData : (remData.locks ?? remData.summaries ?? []))
        }
      }

      // Fetch daily chart data
      const dailyRes = await fetch(`/api/finance/daily?period=${period}`)
      if (dailyRes.ok) {
        const dailyJson = await dailyRes.json()
        const entries = dailyJson.daily ?? []
        setChartData(entries.map((d: any) => ({
          date: new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
          revenue: d.revenue ?? 0,
          expenses: d.costs ?? 0,
        })))
      }

      // Fetch delivery men for remittance form
      if (user.role !== 'SELLER') {
        const dmRes = await fetch('/api/users?role=DELIVERY')
        if (dmRes.ok) {
          const dmData = await dmRes.json()
          setDeliveryMen(dmData.users ?? [])
        }
        // Fetch call center agents for agent fees form
        const ccRes = await fetch('/api/users?role=CALL_CENTER')
        if (ccRes.ok) {
          const ccData = await ccRes.json()
          setCallCenterAgents(ccData.users ?? [])
        }
        // Fetch agent expenses
        const aeRes = await fetch('/api/expenses?limit=50')
        if (aeRes.ok) {
          const aeData = await aeRes.json()
          setAgentExpenses(aeData.expenses ?? [])
        }

        // Fetch delivery performance for delivery fees tab
        const dpRes = await fetch('/api/delivery/performance?period=30')
        if (dpRes.ok) {
          const dpData = await dpRes.json()
          setDeliveryPerf(dpData.performance ?? [])
        }
      }
    } catch (error) {
      console.error('Failed to fetch finance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleWithdrawalRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!withdrawalAmount) return

    try {
      const response = await fetch('/api/finance/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(withdrawalAmount),
          method: 'MOBILE_MONEY',
          account: '+241 77 XX XX XX'
        })
      })

      if (response.ok) {
        fetchData()
        setWithdrawalDialogOpen(false)
        setWithdrawalAmount('')
        showToast('Withdrawal request submitted!', 'ok')
      } else {
        const data = await response.json()
        showToast(data.error || 'Failed to submit withdrawal request', 'no')
      }
    } catch (error) {
      showToast('Failed to submit withdrawal request', 'no')
    }
  }

  const handleProcessWithdrawal = async (id: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`/api/finance/withdrawals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (response.ok) {
        fetchData()
        showToast(`Withdrawal ${action}d!`, 'ok')
      } else {
        showToast('Failed to process withdrawal', 'no')
      }
    } catch (error) {
      showToast('Failed to process withdrawal', 'no')
    }
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expenseCategory || !expenseAmount) return

    try {
      const response = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expense',
          category: expenseCategory.toUpperCase().replace(' ', '_'),
          amount: parseFloat(expenseAmount),
          description: expenseDescription,
          sellerId: expenseSellerId || null
        })
      })

      if (response.ok) {
        fetchData()
        setExpenseDialogOpen(false)
        setExpenseCategory('')
        setExpenseAmount('')
        setExpenseDescription('')
        setExpenseSellerId('')
        showToast('Expense logged!', 'ok')
      }
    } catch (error) {
      showToast('Failed to log expense', 'no')
    }
  }

  const handleLockRemittance = async () => {
    if (!remDriver || !remStartDate || !remEndDate) {
      showToast('Please fill all fields', 'no')
      return
    }

    try {
      const response = await fetch('/api/finance/remittance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryManId: remDriver,
          dateFrom: new Date(remStartDate).toISOString(),
          dateTo: new Date(remEndDate).toISOString(),
          cashCollected: 0 // Will be calculated
        })
      })

      if (response.ok) {
        fetchData()
        setRemDriver('')
        setRemStartDate('')
        setRemEndDate('')
        showToast('Remittance lock created! Invoice generated.', 'ok')
      }
    } catch (error) {
      showToast('Failed to lock remittance', 'no')
    }
  }

  const downloadInvoicePDF = async (invoiceId: string, ref: string) => {
    try {
      const response = await fetch(`/api/finance/invoices/${invoiceId}/pdf`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `invoice-${ref}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      showToast('Failed to download invoice', 'no')
    }
  }

  const showToast = (message: string, type: 'ok' | 'no') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2400)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GA', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get wallet card details
  const walletCards = wallets.map((w, i) => ({
    index: i,
    name: w.seller.name,
    role: 'Seller',
    balance: w.balance,
    totalEarned: w.totalEarned,
    totalDeducted: w.totalDeducted,
    sub: 'Available for withdrawal'
  }))

  const selectedWallet = walletCards[selectedWalletIndex] || null

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) return null

  const maxChartValue = Math.max(...chartData.map(c => Math.max(c.revenue, c.expenses)))

  return (
    <>
      <div className="space-y-4">
        {/* Toast notification */}
        {toast && (
          <div className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300",
            toast.type === 'ok' ? "bg-orange-500" : "bg-red-500"
          )}>
            <p className="text-white text-sm font-semibold">{toast.message}</p>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-2">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">E-Gabon Prime — Finance & Wallet</h1>
            <div className="flex items-center gap-1 px-3 py-1 bg-green-50 rounded-full border border-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-semibold text-green-700">System Live</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                const days = period === 'today' ? 1 : period === '7d' ? 7 : 30
                const res = await fetch(`/api/finance/export?period=${days}`)
                if (!res.ok) throw new Error()
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `finance-export-${period}.xlsx`
                a.click()
                URL.revokeObjectURL(url)
                showToast('Export téléchargé !', 'ok')
              } catch {
                showToast('Erreur lors de l\'export', 'no')
              }
            }}>
              📄 Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWithdrawalDialogOpen(true)}>
              💸 Request Withdrawal
            </Button>
            {user.role !== 'SELLER' && (
              <Button size="sm" onClick={() => setExpenseDialogOpen(true)}>
                + Add Expense
              </Button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-0 border-b border-gray-200 bg-white">
          <div className="px-5 py-4 border-r border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500">Revenue</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.revenue ? (stats.revenue / 1000000).toFixed(1) + 'M' : '0'}</p>
                <p className="text-[10px]">↑ 12%</p>
              </div>
              <div className="bg-orange-50 p-2 rounded-lg">
                <span className="text-lg">💰</span>
              </div>
            </div>
          </div>
          <div className="px-5 py-4 border-r border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500">Net Profit</p>
                <p className="text-3xl font-bold text-green-600">{stats?.netProfit ? (stats.netProfit / 1000000).toFixed(1) + 'M' : '0'}</p>
                <p className="text-[10px]">↑ 18%</p>
              </div>
              <div className="bg-green-50 p-2 rounded-lg">
                <span className="text-lg">📈</span>
              </div>
            </div>
          </div>
          <div className="px-5 py-4 border-r border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500">Expenses</p>
                <p className="text-3xl font-bold text-red-600">{stats?.expenses ? (stats.expenses / 1000).toFixed(0) + 'K' : '0'}</p>
                <p className="text-[10px]">↑ 5%</p>
              </div>
              <div className="bg-red-50 p-2 rounded-lg">
                <span className="text-lg">📉</span>
              </div>
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500">Pending Payouts</p>
                <p className="text-3xl font-bold text-orange-600">{stats?.pendingWithdrawals ? (stats.pendingWithdrawals / 1000).toFixed(0) + 'K' : '0'}</p>
                <p className="text-[10px]">{withdrawals.filter(w => w.status === 'PENDING').length} requests</p>
              </div>
              <div className="bg-gray-50 p-2 rounded-lg">
                <span className="text-lg">💸</span>
              </div>
            </div>
          </div>
        </div>

        {/* Period filters */}
        <div className="flex gap-2 px-2">
          {(['today', '7d', '30d', 'custom'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p as typeof period)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-medium cursor-pointer border transition-colors",
                period === p
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              )}
            >
              {p === 'custom' ? 'Custom' : p === '30d' ? '30 Days' : p === '7d' ? '7 Days' : 'Today'}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="px-2">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 gap-0 border-b-2 border-gray-200">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="wallets">Seller Wallets</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            {user.role !== 'SELLER' && (
              <>
                <TabsTrigger value="remittance">Remittance Lock</TabsTrigger>
                <TabsTrigger value="agentfees">Agent Fees</TabsTrigger>
                <TabsTrigger value="deliveryfees">Delivery Fees</TabsTrigger>
              </>
            )}
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Revenue Breakdown */}
              <Card>
                <CardContent className="pt-6">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">📊 Revenue Breakdown</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">COD Collecté (commandes livrées)</span>
                      <span className="font-bold text-green-600">FCFA {(stats?.revenue ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Nombre de commandes</span>
                      <span className="font-semibold">{stats?.orderCount ?? 0} commandes</span>
                    </div>
                    <div className="flex justify-between items-center text-sm bg-orange-50 p-3 rounded-lg border-none">
                      <span className="font-bold text-gray-900">Total Revenue</span>
                      <span className="font-bold text-orange-600 text-sm">FCFA {(stats?.revenue ?? 0).toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Expense Breakdown */}
              {user.role !== 'SELLER' && (
                <Card>
                  <CardContent className="pt-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">💸 Expense Breakdown</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Toutes dépenses (période)</span>
                        <span className="font-bold text-red-600">FCFA {(stats?.expenses ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Bénéfice net</span>
                        <span className={`font-bold ${(stats?.netProfit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          FCFA {(stats?.netProfit ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm bg-red-50 p-3 rounded-lg border-none">
                        <span className="font-bold text-gray-900">Total Expenses</span>
                        <span className="font-bold text-red-600 text-sm">FCFA {(stats?.expenses ?? 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Chart */}
            <Card className="overflow-hidden">
              <CardContent className="p-4">
                <h4 className="text-xs font-bold text-gray-500 mb-3">📈 Revenue vs Expenses — Last 7 Days</h4>
                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-36 text-gray-400 text-sm">
                    Aucune donnée pour cette période
                  </div>
                ) : (
                  <div className="flex items-end gap-2 h-36">
                    {chartData.map((c, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-[9px] font-bold text-gray-600">{c.revenue >= 1000 ? Math.round(c.revenue / 1000) + 'K' : c.revenue}</div>
                        <div className="flex gap-0.5 w-full items-end" style={{height: '96px'}}>
                          <div className="flex-1 rounded-t bg-orange-500 transition-all" style={{height: maxChartValue > 0 ? ((c.revenue / maxChartValue) * 96) + 'px' : '2px'}}></div>
                          <div className="flex-1 rounded-t bg-red-400 transition-all" style={{height: maxChartValue > 0 ? ((c.expenses / maxChartValue) * 96) + 'px' : '2px'}}></div>
                        </div>
                        <div className="text-[8px] text-gray-500 font-semibold truncate w-full text-center">{c.date}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
                  <span>🟧 Revenue</span>
                  <span>🟥 Expenses</span>
                </div>
              </CardContent>
            </Card>

            {/* By Seller Table */}
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">💰 By Seller — Income & Expenses</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-semibold">Seller</th>
                        <th className="text-right py-2 px-3 font-semibold">Revenue</th>
                        <th className="text-right py-2 px-3 font-semibold">Expenses</th>
                        <th className="text-right py-2 px-3 font-semibold">Fees</th>
                        <th className="text-right py-2 px-3 font-semibold">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bySeller.map((seller) => (
                        <tr key={seller.sellerId} className="border-b">
                          <td className="py-3 px-3 font-semibold">{seller.sellerName}</td>
                          <td className="py-3 px-3 text-right font-bold text-green-600">
                            {(seller.revenue / 1000000).toFixed(1) + 'M'}
                          </td>
                          <td className="py-3 px-3 text-right text-red-600">
                            {(seller.expenses / 1000).toFixed(0) + 'K'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {(seller.fees / 1000).toFixed(0) + 'K'}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-orange-600">
                            {(seller.netProfit / 1000000).toFixed(1) + 'M'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SELLER WALLETS TAB */}
          <TabsContent value="wallets" className="space-y-4 pt-4">
            {/* Wallet Cards */}
            <div className="grid grid-cols-3 gap-2">
              {walletCards.map((wallet, index) => (
                <div
                  key={wallet.index}
                  onClick={() => setSelectedWalletIndex(wallet.index)}
                  className={cn(
                    "bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md",
                    selectedWalletIndex === wallet.index
                      ? "border-orange-500 shadow-md ring-2 ring-orange-100"
                      : "border-gray-200"
                  )}
                >
                  <div className="font-bold text-gray-900">{wallet.name}</div>
                  <div className="text-xs text-gray-500">Seller</div>
                  <div className="text-2xl font-bold text-orange-600 mt-2">
                    FCFA {(wallet.balance / 1000).toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{wallet.sub}</div>
                </div>
              ))}
            </div>

            {/* Wallet Detail */}
            {selectedWallet && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">💳 Wallet — {selectedWallet.name}</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Total Earned</span>
                        <span className="font-bold text-green-600">FCFA {selectedWallet.totalEarned?.toLocaleString() ?? '0'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Total Déduit</span>
                        <span className="font-bold text-red-600">-FCFA {selectedWallet.totalDeducted?.toLocaleString() ?? '0'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm bg-orange-50 p-3 rounded-lg border-none">
                        <span className="font-bold text-gray-900">Current Balance</span>
                        <span className="font-bold text-orange-600 text-sm">FCFA {selectedWallet.balance.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Transactions */}
                <Card>
                  <CardContent className="pt-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">📜 Recent Transactions</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3 font-semibold">Date</th>
                            <th className="text-left py-2 px-3 font-semibold">Type</th>
                            <th className="text-left py-2 px-3 font-semibold">Description</th>
                            <th className="text-right py-2 px-3 font-semibold">Amount</th>
                            <th className="text-right py-2 px-3 font-semibold">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.slice(0, 5).map((tx) => (
                            <tr key={tx.id} className="border-b">
                              <td className="py-3 px-3 text-xs text-gray-500">{formatDate(tx.createdAt)}</td>
                              <td>
                                <Badge variant={tx.type === 'CREDIT' ? 'default' : 'secondary'} className="text-[10px]">
                                  {tx.type === 'CREDIT' ? '↑ Credit' : '↓ Debit'}
                                </Badge>
                              </td>
                              <td className="text-xs text-gray-700">{tx.description}</td>
                              <td className={`text-right font-bold ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                                {tx.type === 'CREDIT' ? '+' : '-'}{formatCurrency(tx.amount)}
                              </td>
                              <td className="text-right font-semibold">{formatCurrency(selectedWallet.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* TRANSACTIONS TAB */}
          <TabsContent value="transactions" className="pt-4">
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">All Transactions</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-semibold">Date</th>
                        <th className="text-left py-2 px-3 font-semibold">Type</th>
                        <th className="text-left py-2 px-3 font-semibold">Description</th>
                        {user.role !== 'SELLER' && <th className="text-left py-2 px-3 font-semibold">Seller</th>}
                        <th className="text-right py-2 px-3 font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b">
                          <td className="py-3 px-3 text-xs text-gray-500">{formatDateTime(tx.createdAt)}</td>
                          <td>
                            <Badge variant={tx.type === 'CREDIT' ? 'default' : 'secondary'} className="text-[10px]">
                              {tx.type === 'CREDIT' ? '↑ Credit' : '↓ Debit'}
                            </Badge>
                          </td>
                          <td className="text-xs text-gray-700">{tx.description}</td>
                          {user.role !== 'SELLER' && (
                            <td className="text-xs text-gray-700">{tx.wallet?.seller?.name || '-'}</td>
                          )}
                          <td className={`text-right font-bold ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.type === 'CREDIT' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WITHDRAWALS TAB */}
          <TabsContent value="withdrawals" className="pt-4">
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">Withdrawal Requests</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-semibold">Date</th>
                        <th className="text-left py-2 px-3 font-semibold">Seller</th>
                        <th className="text-right py-2 px-3 font-semibold">Amount</th>
                        <th className="text-left py-2 px-3 font-semibold">Method</th>
                        <th className="text-left py-2 px-3 font-semibold">Account</th>
                        <th className="text-center py-2 px-3 font-semibold">Status</th>
                        <th className="text-center py-2 px-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawals.map((wd) => (
                        <tr key={wd.id} className="border-b">
                          <td className="py-3 px-3 text-xs text-gray-500">{formatDate(wd.requestedAt)}</td>
                          <td className="py-3 px-3 font-semibold">{wd.wallet.seller.name}</td>
                          <td className="py-3 px-3 font-bold">FCFA {(wd.amount / 1000).toFixed(0)}</td>
                          <td className="py-3 px-3 text-xs">{wd.method.replace('_', ' ')}</td>
                          <td className="py-3 px-3 text-xs font-mono">{wd.account || 'N/A'}</td>
                          <td className="py-3 px-3 text-center">
                            <Badge
                              variant={wd.status === 'PAID' ? 'default' : wd.status === 'APPROVED' ? 'default' : 'secondary'}
                              className="text-[10px]"
                            >
                              {wd.status === 'PENDING' && <Clock className="h-3 w-3 inline" />}
                              {wd.status === 'PAID' && <CheckCircle2 className="h-3 w-3 inline" />}
                              {wd.status === 'REJECTED' && <XCircle className="h-3 w-3 inline" />}
                              {wd.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {wd.status === 'PENDING' && user?.role !== 'SELLER' && (
                              <div className="flex gap-1 justify-center">
                                <button
                                  onClick={() => handleProcessWithdrawal(wd.id, 'approve')}
                                  className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold hover:bg-green-200"
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  onClick={() => handleProcessWithdrawal(wd.id, 'reject')}
                                  className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-bold hover:bg-red-100"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                            {wd.status !== 'PENDING' && (
                              <span className="text-xs text-gray-500">
                                {wd.processedAt ? formatDate(wd.processedAt) : '-'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INVOICES TAB */}
          <TabsContent value="invoices" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Invoice Summary */}
              <Card>
                <CardContent className="pt-6">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">📦 Résumé des Factures</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total factures</span>
                      <span className="font-semibold">{invoices.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Factures verrouillées</span>
                      <span className="font-semibold">{invoices.filter(i => i.isLocked).length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total net (toutes factures)</span>
                      <span className="font-bold text-orange-600">FCFA {invoices.reduce((s, i) => s + i.totalNet, 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Cash collecté total</span>
                      <span className="font-bold text-green-600">FCFA {invoices.reduce((s, i) => s + i.cashCollected, 0).toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Seller Flat Fee */}
              <Card>
                <CardContent className="pt-6">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">📊 Seller Flat Fee (5,000 XAF)</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Platform Service Fee</span>
                      <span className="font-semibold">FCFA 5,000/seller</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Active Sellers</span>
                      <span className="font-semibold">{wallets.length} sellers</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Monthly Collection</span>
                      <span className="font-bold text-orange-600">FCFA {(wallets.length * 5000).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm bg-orange-50 p-3 rounded-lg">
                      <span className="text-xs font-medium text-gray-500">Fee automatically deducted on invoice lock</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Invoices Table */}
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-semibold">Invoice #</th>
                        <th className="text-left py-2 px-3 font-semibold">Period</th>
                        <th className="text-left py-2 px-3 font-semibold">Seller / Driver</th>
                        <th className="text-left py-2 px-3 font-semibold">Type</th>
                        <th className="text-right py-2 px-3 font-semibold">Total</th>
                        <th className="text-center py-2 px-3 font-semibold">Status</th>
                        <th className="text-center py-2 px-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="border-b">
                          <td className="py-3 px-3 text-xs font-mono">{inv.ref}</td>
                          <td className="py-3 px-3 text-xs">{formatDate(inv.dateFrom)} – {formatDate(inv.dateTo)}</td>
                          <td className="py-3 px-3 font-semibold">{inv.seller?.name || inv.deliveryMan?.name || '-'}</td>
                          <td className="py-3 px-3 text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {inv.cycleType === 'SELLER' ? 'Seller Invoice' : 'Remittance Lock'}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-right font-bold">FCFA {(inv.totalNet / 1000).toFixed(0)}</td>
                          <td className="py-3 px-3 text-center">
                            <Badge
                              variant={inv.isLocked ? 'default' : 'secondary'}
                              className={inv.isLocked ? '' : 'bg-gray-100'}
                            >
                              {inv.isLocked && <Lock className="h-3 w-3 inline" />}
                              {inv.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadInvoicePDF(inv.id, inv.ref)}
                              className="text-[10px]"
                            >
                              📄 PDF
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REMITTANCE LOCK TAB (Admin only) */}
          {user.role !== 'SELLER' && (
            <TabsContent value="remittance" className="space-y-4 pt-4">
              {/* Lock Form */}
              <Card>
                <CardContent className="pt-6">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">🔒 Create Remittance Lock</h4>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Delivery Man</Label>
                      <Select value={remDriver} onValueChange={setRemDriver}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {deliveryMen.length === 0 ? (
                            <SelectItem value="none" disabled>Aucun livreur disponible</SelectItem>
                          ) : (
                            deliveryMen.map((dm) => (
                              <SelectItem key={dm.id} value={dm.id}>{dm.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Start Date</Label>
                      <Input type="date" value={remStartDate} onChange={(e) => setRemStartDate(e.target.value)} className="w-full" />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">End Date</Label>
                      <Input type="date" value={remEndDate} onChange={(e) => setRemEndDate(e.target.value)} className="w-full" />
                    </div>
                  </div>
                  <Button onClick={handleLockRemittance} className="w-full bg-orange-500 text-white hover:bg-orange-600">
                    Lock Period & Generate Invoice
                  </Button>
                </CardContent>
              </Card>

              {/* Locks Table */}
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-semibold">Lock #</th>
                          <th className="text-left py-2 px-3 font-semibold">Delivery Man</th>
                          <th className="text-left py-2 px-3 font-semibold">Period</th>
                          <th className="text-right py-2 px-3 font-semibold">Cash Collected</th>
                          <th className="text-center py-2 px-3 font-semibold">Deliveries</th>
                          <th className="text-right py-2 px-3 font-semibold">Fees</th>
                          <th className="text-right py-2 px-3 font-semibold">Net Due</th>
                          <th className="text-center py-2 px-3 font-semibold">Status</th>
                          <th className="text-center py-2 px-3 font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {remittanceLocks.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-10 text-gray-400 text-sm">
                              Aucun verrouillage de remise créé
                            </td>
                          </tr>
                        ) : remittanceLocks.map((lock) => (
                          <tr key={lock.id} className="border-b">
                            <td className="py-3 px-3 text-xs font-mono">{lock.id.slice(0, 12).toUpperCase()}</td>
                            <td className="py-3 px-3 font-semibold">{lock.deliveryMan.name}</td>
                            <td className="py-3 px-3 text-xs">{formatDate(lock.periodStart)} – {formatDate(lock.periodEnd)}</td>
                            <td className="py-3 px-3 text-right font-bold text-green-600">FCFA {lock.cashCollected.toLocaleString()}</td>
                            <td className="py-3 px-3 text-center font-semibold">{lock.deliveryCount}</td>
                            <td className="py-3 px-3 text-right font-bold text-red-600">-FCFA {lock.totalFees.toLocaleString()}</td>
                            <td className="py-3 px-3 text-right font-bold text-orange-600">FCFA {lock.netDue.toLocaleString()}</td>
                            <td className="py-3 px-3 text-center">
                              <Badge variant={lock.status === 'LOCKED' ? 'default' : 'secondary'} className="text-[10px]">
                                {lock.status === 'LOCKED' ? '🔒 Verrouillé' : '⏳ En attente'}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <Button size="sm" variant="outline" className="text-[10px]" onClick={() => downloadInvoicePDF(lock.id, lock.id)}>
                                📄 PDF
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Fee Breakdown */}
              <Card>
                <CardContent className="pt-6">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">📊 Fee Breakdown Structure</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Cost per Delivery</span>
                        <span className="font-semibold">FCFA 1,500</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Bonus per on-time delivery</span>
                        <span className="font-bold text-green-600">+FCFA 200</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Penalty per late delivery</span>
                        <span className="font-bold text-red-600">-FCFA 300</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Platform cut (from COD)</span>
                        <span className="font-semibold">5%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Target On-Time Rate</span>
                        <span className="font-semibold">&gt; 90%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* AGENT FEES TAB (Admin only) */}
          {user.role !== 'SELLER' && (
            <TabsContent value="agentfees" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Add Expense Form */}
                <Card>
                  <CardContent className="pt-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">📞 Add Agent Expense</h4>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Agent</Label>
                        <Select value={agentId} onValueChange={setAgentId}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sélectionner un agent..." />
                          </SelectTrigger>
                          <SelectContent>
                            {callCenterAgents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Type de dépense</Label>
                        <Select value={agentExpenseType} onValueChange={setAgentExpenseType}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sélectionner un type..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INTERNET">Internet</SelectItem>
                            <SelectItem value="CALL_MINUTES">Minutes d'appel</SelectItem>
                            <SelectItem value="EQUIPMENT">Équipement</SelectItem>
                            <SelectItem value="TRANSPORT">Transport</SelectItem>
                            <SelectItem value="OTHER">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Montant (XAF)</Label>
                        <Input type="number" placeholder="0" value={agentAmount} onChange={(e) => setAgentAmount(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Description (optionnel)</Label>
                        <Input placeholder="Notes..." value={agentDescription} onChange={(e) => setAgentDescription(e.target.value)} />
                      </div>
                      <Button onClick={async () => {
                        if (!agentId || !agentExpenseType || !agentAmount) {
                          showToast('Remplissez tous les champs requis', 'no')
                          return
                        }
                        try {
                          const res = await fetch('/api/expenses', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              agentId,
                              category: agentExpenseType,
                              amount: parseFloat(agentAmount),
                              description: agentDescription || null,
                            })
                          })
                          if (!res.ok) throw new Error()
                          showToast('Dépense enregistrée !', 'ok')
                          setAgentId('')
                          setAgentExpenseType('')
                          setAgentAmount('')
                          setAgentDescription('')
                          fetchData()
                        } catch {
                          showToast('Erreur lors de l\'enregistrement', 'no')
                        }
                      }} className="w-full bg-orange-500 text-white hover:bg-orange-600">
                        Enregistrer la dépense
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Agent Summary */}
                <Card>
                  <CardContent className="pt-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">📊 Agent Summary (This Month)</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total dépenses agents</span>
                      <span className="font-bold text-red-600">FCFA {agentExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Agents actifs</span>
                      <span className="font-semibold">{callCenterAgents.length} agents</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Nombre de dépenses</span>
                      <span className="font-semibold">{agentExpenses.length} entrées</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Agent Expense History */}
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">Agent Expense History</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-semibold">Date</th>
                        <th className="text-left py-2 px-3 font-semibold">Agent</th>
                        <th className="text-left py-2 px-3 font-semibold">Type</th>
                        <th className="text-left py-2 px-3 font-semibold">Description</th>
                        <th className="text-right py-2 px-3 font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-gray-400 text-sm">Aucune dépense enregistrée</td>
                        </tr>
                      ) : agentExpenses.map((expense) => (
                        <tr key={expense.id} className="border-b">
                          <td className="py-3 px-3 text-xs text-gray-500">{formatDate(expense.createdAt)}</td>
                          <td className="py-3 px-3 font-semibold">{expense.agent?.name || 'Général'}</td>
                          <td className="py-3 px-3">
                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
                              {expense.category.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-xs">{expense.description || '—'}</td>
                          <td className="py-3 px-3 text-right font-bold text-red-600">-FCFA {expense.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* DELIVERY FEES TAB - Admin only */}
          {user.role !== 'SELLER' && (
            <TabsContent value="deliveryfees" className="space-y-4 pt-4">
              {/* Configure Fees Form */}
              <Card>
                <CardContent className="pt-6">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">⚙️ Configure Delivery Man Fees</h4>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Delivery Man</Label>
                      <Select>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {deliveryMen.map((dm) => (
                            <SelectItem key={dm.id} value={dm.id}>{dm.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Cost per Delivery (XAF)</Label>
                      <Input type="number" defaultValue={1500} />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Bonus Amount (XAF)</Label>
                      <Input type="number" defaultValue={200} />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Penalty Amount (XAF)</Label>
                      <Input type="number" defaultValue={300} />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">On-time threshold (hours)</Label>
                      <Input type="number" defaultValue={24} />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={() => showToast('Fee config saved!', 'ok')} className="w-full bg-orange-500 text-white hover:bg-orange-600">
                        Save Config
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Table */}
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-semibold">Delivery Man</th>
                          <th className="text-right py-2 px-3 font-semibold">Cost/Delivery</th>
                          <th className="text-right py-2 px-3 font-semibold">Bonus</th>
                          <th className="text-right py-2 px-3 font-semibold">Penalty</th>
                          <th className="text-center py-2 px-3 font-semibold">Deliveries (30d)</th>
                          <th className="text-center py-2 px-3 font-semibold">On-Time Rate</th>
                          <th className="text-right py-2 px-3 font-semibold">Net Earnings</th>
                          <th className="text-center py-2 px-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveryPerf.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-10 text-center text-sm text-gray-400">Aucune donnée de performance disponible</td>
                          </tr>
                        ) : deliveryPerf.map((dp) => {
                          const rate = parseFloat(dp.deliveryRate)
                          const BASE_FEE = 1500
                          const netEarnings = dp.delivered * BASE_FEE
                          const rateColor = rate >= 90 ? 'text-green-600' : rate >= 75 ? 'text-yellow-600' : 'text-red-600'
                          const isOnProbation = rate < 75
                          return (
                            <tr key={dp.id} className="border-b">
                              <td className="py-3 px-3 font-semibold">{dp.name}</td>
                              <td className="py-3 px-3 text-right font-semibold">FCFA {BASE_FEE.toLocaleString()}</td>
                              <td className="py-3 px-3 text-right font-bold text-green-600">—</td>
                              <td className="py-3 px-3 text-right font-bold text-red-600">—</td>
                              <td className="py-3 px-3 text-center font-semibold">{dp.delivered}</td>
                              <td className={`py-3 px-3 text-center font-bold ${rateColor}`}>{dp.deliveryRate}%</td>
                              <td className="py-3 px-3 text-right font-bold text-orange-600">FCFA {netEarnings.toLocaleString()}</td>
                              <td className="py-3 px-3 text-center">
                                {isOnProbation
                                  ? <Badge variant="destructive" className="text-[10px]">En probation</Badge>
                                  : <Badge variant="default" className="text-[10px]">Actif</Badge>
                                }
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">📊 Performance Metrics (30 Jours)</h4>
                    {(() => {
                      const BASE_FEE = 1500
                      const totalDeliveries = deliveryPerf.reduce((s, d) => s + d.delivered, 0)
                      const avgRate = deliveryPerf.length > 0
                        ? (deliveryPerf.reduce((s, d) => s + parseFloat(d.deliveryRate), 0) / deliveryPerf.length).toFixed(1)
                        : '0.0'
                      const totalFees = totalDeliveries * BASE_FEE
                      return (
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Total Livraisons</span>
                            <span className="font-bold">{totalDeliveries}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Taux Moyen</span>
                            <span className={`font-bold ${parseFloat(avgRate) >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>{avgRate}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Total Frais Payés</span>
                            <span className="font-bold text-red-600">FCFA {totalFees.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Nombre de Livreurs</span>
                            <span className="font-bold">{deliveryPerf.length}</span>
                          </div>
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 pb-2 border-b">🎯 Fee Settings Summary</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Base Delivery Fee</span>
                        <span className="font-semibold">FCFA 1,500</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">On-Time Bonus</span>
                        <span className="font-bold text-green-600">+FCFA 200</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Late Penalty</span>
                        <span className="font-bold text-red-600">-FCFA 300</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Target On-Time Rate</span>
                        <span className="font-semibold">&gt; 90%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Withdrawal Dialog */}
      <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>💸 Request Withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500">Available Balance</p>
              <p className="text-2xl font-bold text-orange-600">FCFA {(wallets[0]?.balance || 0).toLocaleString()}</p>
            </div>
            <div>
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Amount (XAF)</Label>
              <Input type="number" value={withdrawalAmount} onChange={(e) => setWithdrawalAmount(e.target.value)} placeholder="200000" />
            </div>
            <div>
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Payment Method</Label>
              <Select value="MOBILE_MONEY">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Account Details</Label>
              <Input placeholder="+241 77 XX XX XX or BGFI account" />
            </div>
            <Button onClick={handleWithdrawalRequest} className="w-full bg-orange-500 text-white hover:bg-orange-600">
              Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>+ Log Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Category</Label>
              <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <option value="">Select category...</option>
                  <option value="SHIPPING">Shipping</option>
                  <option value="CALL_CENTER">Call Center</option>
                  <option value="SOURCING">Sourcing</option>
                  <option value="AD_SPEND">Ad Spend</option>
                  <option value="OTHER">Other</option>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Amount (XAF)</Label>
              <Input type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Seller (optional)</Label>
              <Select value={expenseSellerId} onValueChange={setExpenseSellerId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <option value="">Platform-wide</option>
                  {wallets.map(w => (
                    <option key={w.sellerId} value={w.sellerId}>{w.seller.name}</option>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Description</Label>
              <Input value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} placeholder="What was this expense for?" />
            </div>
            <Button onClick={handleAddExpense} className="w-full bg-orange-500 text-white hover:bg-orange-600">
              Save Expense
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </>
    )
}
