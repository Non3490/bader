'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RequirePermission } from '@/components/admin/PermissionGate'
import { useAdminSession } from '@/hooks/use-admin-session'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CreditCard,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  User
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from 'recharts'
import { format } from 'date-fns'

interface FinanceOverview {
  current: {
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    platformFees: number
    callCenterExpenses: number
    deliveryFees: number
    sellerExpenses: number
    orderCount: number
  }
  comparison: {
    revenue: { current: number; previous: number; change: number; changePercent: number }
    expenses: { current: number; previous: number; change: number; changePercent: number }
    netProfit: { current: number; previous: number; change: number; changePercent: number }
  }
  pending: {
    codAmounts: number
    withdrawalRequests: number
    withdrawalAmount: number
  }
}

interface WithdrawalRequest {
  id: string
  amount: number
  status: string
  method: string
  walletDetails: string
  createdAt: Date
  wallet: {
    seller: {
      name: string
      email: string
    }
  }
}

const EXPENSE_CATEGORIES = [
  { name: 'Seller Expenses', key: 'sellerExpenses', color: '#3b82f6' },
  { name: 'Call Center', key: 'callCenterExpenses', color: '#f59e0b' },
  { name: 'Delivery', key: 'deliveryFees', color: '#10b981' },
  { name: 'Platform Fees', key: 'platformFees', color: '#8b5cf6' },
]

const PERIOD_LABELS: Record<string, string> = {
  today: 'Today',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
}

export default function FinanceDashboardPage() {
  const { session } = useAdminSession()
  const [data, setData] = useState<FinanceOverview | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    fetchFinanceData()
    fetchWithdrawals()
  }, [period])

  const fetchFinanceData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/finance?period=${period}`)
      if (response.ok) {
        const financeData = await response.json()
        setData(financeData)
      }
    } catch (error) {
      console.error('Failed to fetch finance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWithdrawals = async () => {
    try {
      const response = await fetch('/api/admin/finance/withdrawals')
      if (response.ok) {
        const withdrawalsData = await response.json()
        setWithdrawals(withdrawalsData.withdrawals || [])
      }
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-GA', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const PercentChange = ({ value }: { value: number }) => {
    const isPositive = value >= 0
    const isNeutral = Math.abs(value) < 0.01
    return (
      <div className={`flex items-center gap-1 ${isNeutral ? 'text-gray-500' : isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isNeutral ? null : isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        <span className="font-medium">{isNeutral ? '0.0' : Math.abs(value).toFixed(1)}%</span>
      </div>
    )
  }

  const MetricCard = ({ title, value, change, icon: Icon }: {
    title: string
    value: string | number
    change?: { change: number; changePercent: number }
    icon?: any
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{typeof value === 'number' ? formatCurrency(value) : value}</div>
        {change && (
          <div className="mt-1">
            <PercentChange value={change.changePercent} />
            <span className="text-xs text-muted-foreground ml-1">vs previous period</span>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const handleWithdrawalAction = async (id: string, action: 'approve' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this withdrawal request?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/finance/withdrawals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (response.ok) {
        fetchFinanceData()
        fetchWithdrawals()
      } else {
        const error = await response.json()
        alert(`Failed to ${action} withdrawal: ${error.error}`)
      }
    } catch (error) {
      console.error(`Failed to ${action} withdrawal:`, error)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-muted-foreground">Failed to load finance data</div>
      </div>
    )
  }

  // Prepare expense breakdown data
  const expenseBreakdown = EXPENSE_CATEGORIES.map(cat => ({
    name: cat.name,
    value: data.current[cat.key as keyof typeof data.current] as number,
    color: cat.color
  })).filter(item => item.value > 0)

  return (
    <RequirePermission permission="reports:view_all">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Finance Dashboard</h1>
            <p className="text-muted-foreground">
              Platform revenue, expenses, and financial performance
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchFinanceData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Revenue"
            value={data.current.totalRevenue}
            change={data.comparison.revenue}
            icon={DollarSign}
          />
          <MetricCard
            title="Total Expenses"
            value={data.current.totalExpenses}
            change={data.comparison.expenses}
            icon={CreditCard}
          />
          <MetricCard
            title="Net Profit"
            value={data.current.netProfit}
            change={data.comparison.netProfit}
            icon={TrendingUp}
          />
          <MetricCard
            title="Order Count"
            value={data.current.orderCount}
            icon={Wallet}
          />
        </div>

        {/* Pending Items */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pending COD Amounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(data.pending.codAmounts)}</div>
              <p className="text-xs text-muted-foreground mt-1">Undelivered orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{data.pending.withdrawalRequests}</div>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(data.pending.withdrawalAmount)} pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Platform Fees Collected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(data.current.platformFees)}</div>
              <p className="text-xs text-muted-foreground mt-1">{PERIOD_LABELS[period]}</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Expense Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Expense Breakdown</CardTitle>
              <CardDescription>Distribution of expenses by category</CardDescription>
            </CardHeader>
            <CardContent>
              {expenseBreakdown.length > 0 ? (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseBreakdown}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {expenseBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    {expenseBreakdown.map(item => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No expenses recorded for this period</div>
              )}
            </CardContent>
          </Card>

          {/* Expense Comparison Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Current vs Previous Period</CardTitle>
              <CardDescription>Revenue and expenses comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      {
                        name: 'Revenue',
                        current: data.comparison.revenue.current,
                        previous: data.comparison.revenue.previous,
                      },
                      {
                        name: 'Expenses',
                        current: data.comparison.expenses.current,
                        previous: data.comparison.expenses.previous,
                      },
                      {
                        name: 'Net Profit',
                        current: data.comparison.netProfit.current,
                        previous: data.comparison.netProfit.previous,
                      },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `${value / 1000}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="current" fill="#3b82f6" name="Current Period" />
                    <Bar dataKey="previous" fill="#94a3b8" name="Previous Period" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Withdrawal Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Withdrawal Requests</CardTitle>
            <CardDescription>Manage seller withdrawal requests</CardDescription>
          </CardHeader>
          <CardContent>
            {withdrawals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No pending withdrawal requests</div>
            ) : (
              <div className="space-y-4">
                {withdrawals.map((withdrawal) => (
                  <div key={withdrawal.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">{withdrawal.wallet.seller.name}</div>
                        <div className="text-sm text-muted-foreground">{withdrawal.wallet.seller.email}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {withdrawal.method} • {withdrawal.walletDetails}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold">{formatCurrency(withdrawal.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(withdrawal.createdAt), 'PPp')}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => handleWithdrawalAction(withdrawal.id, 'approve')}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleWithdrawalAction(withdrawal.id, 'reject')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Expense Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Expense Breakdown</CardTitle>
            <CardDescription>View of all expense categories for {PERIOD_LABELS[period]}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {EXPENSE_CATEGORIES.map(cat => (
                <div key={cat.key} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="font-medium">{cat.name}</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(data.current[cat.key as keyof typeof data.current] as number)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  )
}
