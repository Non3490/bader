'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  Package,
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
  Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface FinancialStats {
  revenue: number
  expenses: number
  netProfit: number
  pendingWithdrawals: number
  platformFees: number
  callCenterExpenses: number
  deliveryFees: number
  sellerExpenses: number
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
}

export default function FinanceTabPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [bySeller, setBySeller] = useState<SellerFinancial[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('30d')
  const [activeTab, setActiveTab] = useState('overview')

  // Withdrawal request dialog
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false)
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [withdrawalMethod, setWithdrawalMethod] = useState('MOBILE_MONEY')
  const [withdrawalAccount, setWithdrawalAccount] = useState('')

  // Add expense dialog
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false)
  const [expenseCategory, setExpenseCategory] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseSellerId, setExpenseSellerId] = useState('')

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    }
  }, [user, userLoading, router])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user, period, activeTab])

  const fetchData = async () => {
    if (!user) return

    setLoading(true)
    try {
      // Fetch stats
      const statsRes = await fetch(`/api/finance?period=${period}`)
      if (statsRes.ok) {
        setStats(await statsRes.json())
      }

      // Fetch transactions for Transactions tab
      if (activeTab === 'transactions') {
        const txRes = await fetch(`/api/finance/transactions?period=${period}`)
        if (txRes.ok) {
          setTransactions(await txRes.json())
        }
      }

      // Fetch withdrawals for Withdrawals tab
      if (activeTab === 'withdrawals') {
        const wdRes = await fetch(`/api/finance/withdrawals`)
        if (wdRes.ok) {
          setWithdrawals(await wdRes.json())
        }
      }

      // Fetch invoices for Invoices tab
      if (activeTab === 'invoices') {
        const invRes = await fetch(`/api/finance/invoices`)
        if (invRes.ok) {
          setInvoices(await invRes.json())
        }
      }

      // Fetch by-seller data (admin only)
      if (activeTab === 'overview' && user.role !== 'SELLER') {
        const bsRes = await fetch(`/api/finance?type=by-seller&period=${period}`)
        if (bsRes.ok) {
          setBySeller(await bsRes.json())
        }
      }
    } catch (error) {
      toast.error('Failed to load finance data. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  const handleWithdrawalRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !withdrawalAmount) return

    try {
      const response = await fetch('/api/finance/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(withdrawalAmount),
          method: withdrawalMethod,
          account: withdrawalAccount
        })
      })

      if (response.ok) {
        fetchData()
        setWithdrawalDialogOpen(false)
        setWithdrawalAmount('')
        setWithdrawalAccount('')
        toast.success('Withdrawal request submitted successfully')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to submit withdrawal request')
      }
    } catch (error) {
      toast.error('Failed to submit withdrawal request')
    }
  }

  const handleProcessWithdrawal = async (id: string, action: 'approve' | 'reject', note?: string) => {
    try {
      const response = await fetch(`/api/finance/withdrawals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note })
      })

      if (response.ok) {
        fetchData()
        toast.success(`Withdrawal ${action}d successfully`)
      } else {
        toast.error('Failed to process withdrawal')
      }
    } catch (error) {
      toast.error('Failed to process withdrawal')
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
          category: expenseCategory,
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
        toast.success('Expense logged successfully')
      } else {
        toast.error('Failed to log expense')
      }
    } catch (error) {
      toast.error('Failed to log expense')
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
        toast.success(`Invoice ${ref} downloaded`)
      } else {
        toast.error('Failed to download invoice')
      }
    } catch (error) {
      toast.error('Failed to download invoice')
    }
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
      day: 'numeric',
      year: 'numeric'
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

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Finance & Wallet</h1>
            <p className="text-muted-foreground">
              {user.role === 'SELLER' ? 'Track your earnings and manage withdrawals' : 'Platform financial overview'}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
            {user.role !== 'SELLER' && (
              <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Expense
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Log Expense</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddExpense} className="space-y-4">
                    <div>
                      <Label>Category</Label>
                      <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SHIPPING">Shipping</SelectItem>
                          <SelectItem value="CALL_CENTER">Call Center</SelectItem>
                          <SelectItem value="SOURCING">Sourcing</SelectItem>
                          <SelectItem value="AD_SPEND">Ad Spend</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Amount (XAF)</Label>
                      <Input
                        type="number"
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={expenseDescription}
                        onChange={(e) => setExpenseDescription(e.target.value)}
                        placeholder="What was this expense for?"
                      />
                    </div>
                    <Button type="submit" className="w-full">Save Expense</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            {user.role === 'SELLER' && (
              <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Wallet className="h-4 w-4 mr-2" />
                    Request Withdrawal
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Withdrawal</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleWithdrawalRequest} className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">Available Balance</p>
                      <p className="text-2xl font-bold">{stats ? formatCurrency(stats.revenue - stats.expenses) : formatCurrency(0)}</p>
                    </div>
                    <div>
                      <Label>Amount (XAF)</Label>
                      <Input
                        type="number"
                        value={withdrawalAmount}
                        onChange={(e) => setWithdrawalAmount(e.target.value)}
                        placeholder="200000"
                      />
                    </div>
                    <div>
                      <Label>Payment Method</Label>
                      <Select value={withdrawalMethod} onValueChange={setWithdrawalMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                          <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Account Details</Label>
                      <Input
                        value={withdrawalAccount}
                        onChange={(e) => setWithdrawalAccount(e.target.value)}
                        placeholder="+241 77 XX XX XX or BGFI account"
                      />
                    </div>
                    <Button type="submit" className="w-full">Submit Request</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(stats.revenue)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">From {stats.orderCount} delivered orders</p>
                  </div>
                  <div className="bg-orange-100 p-3 rounded-full">
                    <TrendingUp className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Net Profit</p>
                    <p className={cn("text-2xl font-bold", stats.netProfit >= 0 ? "text-green-600" : "text-red-600")}>
                      {formatCurrency(stats.netProfit)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Revenue - Expenses</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-full">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {user.role !== 'SELLER' && (
              <Card className="border-l-4 border-l-red-500">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Expenses</p>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(stats.expenses)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">All operational costs</p>
                    </div>
                    <div className="bg-red-100 p-3 rounded-full">
                      <TrendingDown className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-l-4 border-l-gray-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Payouts</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(stats.pendingWithdrawals)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {withdrawals.filter(w => w.status === 'PENDING').length} requests
                    </p>
                  </div>
                  <div className="bg-gray-100 p-3 rounded-full">
                    <Clock className="h-6 w-6 text-gray-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            {user.role !== 'SELLER' && <TabsTrigger value="by-seller">By Seller</TabsTrigger>}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stats && (
                    <>
                      <div className="flex justify-between items-center pb-2 border-b">
                        <span className="text-sm text-muted-foreground">COD Collected</span>
                        <span className="font-semibold text-green-600">{formatCurrency(stats.revenue)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b">
                        <span className="text-sm text-muted-foreground">Delivery Fees Charged</span>
                        <span className="font-semibold">{formatCurrency(stats.deliveryFees)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b">
                        <span className="text-sm text-muted-foreground">Platform Fees</span>
                        <span className="font-semibold">{formatCurrency(stats.platformFees)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 bg-orange-50 -mx-4 px-4 -mb-4 pb-4 rounded-b-lg">
                        <span className="font-semibold">Total Revenue</span>
                        <span className="font-bold text-orange-600 text-lg">{formatCurrency(stats.revenue)}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {user.role !== 'SELLER' && stats && (
                <Card>
                  <CardHeader>
                    <CardTitle>Expense Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-sm text-muted-foreground">Shipping</span>
                      <span className="font-semibold text-red-600">{formatCurrency(stats.sellerExpenses * 0.4)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-sm text-muted-foreground">Call Center</span>
                      <span className="font-semibold text-red-600">{formatCurrency(stats.callCenterExpenses)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-sm text-muted-foreground">Sourcing / Procurement</span>
                      <span className="font-semibold text-red-600">{formatCurrency(stats.sellerExpenses * 0.3)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 bg-red-50 -mx-4 px-4 -mb-4 pb-4 rounded-b-lg">
                      <span className="font-semibold">Total Expenses</span>
                      <span className="font-bold text-red-600 text-lg">{formatCurrency(stats.expenses)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>All wallet credits and debits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4 font-medium">Date</th>
                        <th className="text-left py-2 px-4 font-medium">Type</th>
                        <th className="text-left py-2 px-4 font-medium">Description</th>
                        {user.role !== 'SELLER' && <th className="text-left py-2 px-4 font-medium">Seller</th>}
                        <th className="text-right py-2 px-4 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            No transactions found for this period
                          </td>
                        </tr>
                      ) : (
                        transactions.map((tx) => (
                          <tr key={tx.id} className="border-b">
                            <td className="py-3 px-4 text-sm">{formatDateTime(tx.createdAt)}</td>
                            <td className="py-3 px-4">
                              <Badge variant={tx.type === 'CREDIT' ? 'default' : 'secondary'}>
                                {tx.type === 'CREDIT' ? '↑ Credit' : '↓ Debit'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-sm">{tx.description}</td>
                            {user.role !== 'SELLER' && (
                              <td className="py-3 px-4 text-sm">
                                {tx.wallet?.seller?.name || '-'}
                              </td>
                            )}
                            <td className={`py-3 px-4 text-right font-bold ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                              {tx.type === 'CREDIT' ? '+' : '-'}{formatCurrency(tx.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals">
            <Card>
              <CardHeader>
                <CardTitle>Withdrawal Requests</CardTitle>
                <CardDescription>Manage payout requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4 font-medium">Date</th>
                        {user.role !== 'SELLER' && <th className="text-left py-2 px-4 font-medium">Seller</th>}
                        <th className="text-right py-2 px-4 font-medium">Amount</th>
                        <th className="text-left py-2 px-4 font-medium">Method</th>
                        <th className="text-left py-2 px-4 font-medium">Account</th>
                        <th className="text-center py-2 px-4 font-medium">Status</th>
                        {user.role !== 'SELLER' && <th className="text-center py-2 px-4 font-medium">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawals.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            No withdrawal requests found
                          </td>
                        </tr>
                      ) : (
                        withdrawals.map((wd) => (
                          <tr key={wd.id} className="border-b">
                            <td className="py-3 px-4 text-sm">{formatDate(wd.requestedAt)}</td>
                            {user.role !== 'SELLER' && (
                              <td className="py-3 px-4 text-sm font-medium">{wd.wallet.seller.name}</td>
                            )}
                            <td className="py-3 px-4 text-right font-bold">{formatCurrency(wd.amount)}</td>
                            <td className="py-3 px-4 text-sm">{wd.method.replace('_', ' ')}</td>
                            <td className="py-3 px-4 text-sm font-mono">{wd.account || 'N/A'}</td>
                            <td className="py-3 px-4 text-center">
                              <Badge
                                variant={
                                  wd.status === 'PAID' ? 'default' :
                                  wd.status === 'APPROVED' ? 'default' :
                                  wd.status === 'REJECTED' ? 'destructive' :
                                  'secondary'
                                }
                              >
                                {wd.status === 'PENDING' && <Clock className="h-3 w-3 inline mr-1" />}
                                {wd.status === 'PAID' && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
                                {wd.status === 'REJECTED' && <XCircle className="h-3 w-3 inline mr-1" />}
                                {wd.status}
                              </Badge>
                            </td>
                            {user.role !== 'SELLER' && wd.status === 'PENDING' && (
                              <td className="py-3 px-4 text-center">
                                <div className="flex gap-2 justify-center">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleProcessWithdrawal(wd.id, 'approve')}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleProcessWithdrawal(wd.id, 'reject')}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            )}
                            {user.role !== 'SELLER' && wd.status !== 'PENDING' && (
                              <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                                {wd.processedAt ? formatDate(wd.processedAt) : '-'}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
                <CardDescription>Seller invoices and remittance records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4 font-medium">Invoice #</th>
                        <th className="text-left py-2 px-4 font-medium">Period</th>
                        <th className="text-left py-2 px-4 font-medium">Type</th>
                        <th className="text-left py-2 px-4 font-medium">
                          {user.role === 'SELLER' ? 'Your' : 'Seller/Delivery'} Name
                        </th>
                        <th className="text-right py-2 px-4 font-medium">Total</th>
                        <th className="text-center py-2 px-4 font-medium">Status</th>
                        <th className="text-center py-2 px-4 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            No invoices found
                          </td>
                        </tr>
                      ) : (
                        invoices.map((inv) => (
                          <tr key={inv.id} className="border-b">
                            <td className="py-3 px-4 text-sm font-mono">{inv.ref}</td>
                            <td className="py-3 px-4 text-sm">
                              {formatDate(inv.dateFrom)} - {formatDate(inv.dateTo)}
                            </td>
                            <td className="py-3 px-4 text-sm">
                              <Badge variant="outline">
                                {inv.cycleType === 'SELLER' ? 'Seller Invoice' : 'Remittance'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-sm font-medium">
                              {inv.seller?.name || inv.deliveryMan?.name || '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-bold">{formatCurrency(inv.totalNet)}</td>
                            <td className="py-3 px-4 text-center">
                              <Badge
                                variant={inv.isLocked ? 'default' : 'secondary'}
                                className={inv.isLocked ? '' : 'bg-gray-100'}
                              >
                                {inv.isLocked && <Lock className="h-3 w-3 inline mr-1" />}
                                {inv.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadInvoicePDF(inv.id, inv.ref)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                PDF
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* By Seller Tab (Admin only) */}
          {user.role !== 'SELLER' && (
            <TabsContent value="by-seller">
              <Card>
                <CardHeader>
                  <CardTitle>Income & Expenses by Seller</CardTitle>
                  <CardDescription>Per-seller financial breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4 font-medium">Seller</th>
                          <th className="text-right py-2 px-4 font-medium">Revenue</th>
                          <th className="text-right py-2 px-4 font-medium">Expenses</th>
                          <th className="text-right py-2 px-4 font-medium">Fees</th>
                          <th className="text-right py-2 px-4 font-medium">Net Profit</th>
                          <th className="text-right py-2 px-4 font-medium">Wallet Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bySeller.map((seller) => (
                          <tr key={seller.sellerId} className="border-b">
                            <td className="py-3 px-4">
                              <div className="font-medium">{seller.sellerName}</div>
                              <div className="text-sm text-muted-foreground">{seller.sellerEmail}</div>
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-green-600">
                              {formatCurrency(seller.revenue)}
                            </td>
                            <td className="py-3 px-4 text-right text-red-600">
                              {formatCurrency(seller.expenses)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {formatCurrency(seller.fees)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-orange-600">
                              {formatCurrency(seller.netProfit)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold">
                              {formatCurrency(seller.walletBalance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Quick Links (for admin) */}
        {user.role !== 'SELLER' && (
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
              <CardDescription>Additional finance tools</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/finance/remittance">
                  <Button variant="outline" className="w-full justify-start">
                    <Lock className="h-4 w-4 mr-2" />
                    Remittance Lock
                  </Button>
                </Link>
                <Link href="/finance/agent-fees">
                  <Button variant="outline" className="w-full justify-start">
                    <Phone className="h-4 w-4 mr-2" />
                    Agent Fees
                  </Button>
                </Link>
                <Link href="/finance/delivery-fees">
                  <Button variant="outline" className="w-full justify-start">
                    <Truck className="h-4 w-4 mr-2" />
                    Delivery Fees
                  </Button>
                </Link>
                <Link href="/finance/wallets">
                  <Button variant="outline" className="w-full justify-start">
                    <Wallet className="h-4 w-4 mr-2" />
                    All Wallets
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
