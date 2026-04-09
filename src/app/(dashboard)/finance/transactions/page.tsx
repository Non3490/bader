'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useUser } from '@/hooks/use-user'
import {
  RefreshCcw,
  Download,
  ArrowUpDown,
  Filter,
  Search
} from 'lucide-react'

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

export default function TransactionsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('30d')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

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
      let url = `/api/finance/transactions?period=${period}`
      if (typeFilter !== 'all') url += `&type=${typeFilter}`

      const response = await fetch(url)
      if (response.ok) {
        setTransactions(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    if (transactions.length === 0) return

    const headers = user?.role !== 'SELLER'
      ? ['Date', 'Type', 'Description', 'Seller', 'Amount']
      : ['Date', 'Type', 'Description', 'Amount']

    const rows = transactions.map(tx => {
      const row = user?.role !== 'SELLER'
        ? [
            new Date(tx.createdAt).toLocaleString(),
            tx.type,
            tx.description,
            tx.wallet?.seller?.name || '-',
            `${tx.type === 'CREDIT' ? '+' : '-'}${tx.amount}`
          ]
        : [
            new Date(tx.createdAt).toLocaleString(),
            tx.type,
            tx.description,
            `${tx.type === 'CREDIT' ? '+' : '-'}${tx.amount}`
          ]
      return row.join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GA', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(value)
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredTransactions = transactions.filter(tx => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        tx.description.toLowerCase().includes(query) ||
        (tx.wallet?.seller?.name?.toLowerCase().includes(query))
      )
    }
    return true
  })

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
            <h1 className="text-2xl font-bold tracking-tight">Wallet Transactions</h1>
            <p className="text-muted-foreground">
              Complete history of all wallet credits and debits
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="CREDIT">Credits</SelectItem>
                <SelectItem value="DEBIT">Debits</SelectItem>
                <SelectItem value="WITHDRAWAL">Withdrawals</SelectItem>
                <SelectItem value="ADJUSTMENT">Adjustments</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2 items-center">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by description or seller name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold">{filteredTransactions.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Credits</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(
                    filteredTransactions
                      .filter(t => t.type === 'CREDIT')
                      .reduce((sum, t) => sum + t.amount, 0)
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Debits</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(
                    filteredTransactions
                      .filter(t => t.type !== 'CREDIT')
                      .reduce((sum, t) => sum + t.amount, 0)
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>
              {filteredTransactions.length} transactions found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium">
                      <div className="flex items-center gap-2">
                        Date
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className="text-left py-2 px-4 font-medium">Type</th>
                    <th className="text-left py-2 px-4 font-medium">Description</th>
                    {user.role !== 'SELLER' && (
                      <th className="text-left py-2 px-4 font-medium">Seller</th>
                    )}
                    <th className="text-right py-2 px-4 font-medium">
                      <div className="flex items-center justify-end gap-2">
                        Amount
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={user.role !== 'SELLER' ? 5 : 4} className="py-12 text-center text-muted-foreground">
                        No transactions found for this period
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b hover:bg-muted/50">
                        <td className="py-4 px-4">
                          <div className="text-sm">{formatDateTime(tx.createdAt)}</div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge
                            variant={tx.type === 'CREDIT' ? 'default' : 'secondary'}
                            className={tx.type === 'CREDIT' ? 'bg-green-100 text-green-700 hover:bg-green-200' : ''}
                          >
                            {tx.type === 'CREDIT' ? '↑ Credit' :
                             tx.type === 'DEBIT' ? '↓ Debit' :
                             tx.type === 'WITHDRAWAL' ? '↗ Withdrawal' :
                             tx.type === 'ADJUSTMENT' ? '⚡ Adjustment' : tx.type}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-sm">{tx.description}</td>
                        {user.role !== 'SELLER' && (
                          <td className="py-4 px-4">
                            <div className="text-sm">{tx.wallet?.seller?.name || '-'}</div>
                          </td>
                        )}
                        <td className={`py-4 px-4 text-right font-bold ${
                          tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                        }`}>
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
      </div>
    </>
  )
}
