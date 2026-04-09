'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useUser } from '@/hooks/use-user'
import {
  RefreshCcw,
  Download,
  Search,
  Receipt,
} from 'lucide-react'

interface Expense {
  id: string
  category: string
  amount: number
  description: string | null
  orderId: string | null
  order: {
    id: string
    trackingNumber: string
    recipientName: string
  } | null
  incurredAt: string
  agent?: { id: string; name: string } | null
  seller?: { id: string; name: string } | null
}

export default function AdminExpensesPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
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
  }, [user])

  const fetchData = async () => {
    if (!user) return

    setLoading(true)
    try {
      const response = await fetch('/api/expenses?limit=200')
      if (response.ok) {
        const data = await response.json()
        setExpenses(data.expenses || [])
      }
    } catch (error) {
      console.error('Failed to fetch expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GA', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const filteredExpenses = expenses.filter((exp) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        exp.category.toLowerCase().includes(query) ||
        (exp.description?.toLowerCase().includes(query)) ||
        (exp.agent?.name?.toLowerCase().includes(query)) ||
        (exp.seller?.name?.toLowerCase().includes(query)) ||
        (exp.order?.trackingNumber?.toLowerCase().includes(query))
      )
    }
    return true
  })

  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0)

  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) return

    const headers = ['Date', 'Category', 'Description', 'Agent', 'Seller', 'Order', 'Amount']
    const rows = filteredExpenses.map((exp) => [
      formatDateTime(exp.incurredAt),
      exp.category,
      exp.description || '-',
      exp.agent?.name || '-',
      exp.seller?.name || '-',
      exp.order?.trackingNumber || '-',
      formatCurrency(exp.amount),
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
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
            <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
            <p className="text-muted-foreground">
              Track all expenses across agents and sellers
            </p>
          </div>
          <div className="flex gap-2 items-center">
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
                placeholder="Search by category, agent, seller, or order..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              {searchQuery && (
                <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
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
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold">{filteredExpenses.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Average per Expense</p>
                <p className="text-2xl font-bold">
                  {filteredExpenses.length > 0
                    ? formatCurrency(totalAmount / filteredExpenses.length)
                    : formatCurrency(0)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Expense History
            </CardTitle>
            <CardDescription>
              {filteredExpenses.length} expenses found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium">Date</th>
                    <th className="text-left py-2 px-4 font-medium">Category</th>
                    <th className="text-left py-2 px-4 font-medium">Description</th>
                    <th className="text-left py-2 px-4 font-medium">Agent</th>
                    <th className="text-left py-2 px-4 font-medium">Seller</th>
                    <th className="text-left py-2 px-4 font-medium">Order</th>
                    <th className="text-right py-2 px-4 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        No expenses found
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="border-b hover:bg-muted/50">
                        <td className="py-4 px-4 text-sm">
                          {formatDateTime(exp.incurredAt)}
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="secondary">{exp.category}</Badge>
                        </td>
                        <td className="py-4 px-4 text-sm">
                          {exp.description || '-'}
                        </td>
                        <td className="py-4 px-4 text-sm">
                          {exp.agent?.name || '-'}
                        </td>
                        <td className="py-4 px-4 text-sm">
                          {exp.seller?.name || '-'}
                        </td>
                        <td className="py-4 px-4 text-sm">
                          {exp.order?.trackingNumber || '-'}
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-red-600">
                          -{formatCurrency(exp.amount)}
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
