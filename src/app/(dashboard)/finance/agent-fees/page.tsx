'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useUser } from '@/hooks/use-user'
import { toast } from 'sonner'
import {
  Phone,
  Plus,
  TrendingUp,
  DollarSign,
  Calendar,
  RefreshCcw,
  FileText,
  Loader2
} from 'lucide-react'

interface AgentExpense {
  id: string
  agentId: string | null
  category: string
  expenseType: { id: string; name: string } | null
  amount: number
  description: string | null
  incurredAt: string
  agent?: {
    id: string
    name: string
    email: string
  }
}

interface AgentStats {
  agentId: string | null
  totalExpenses: number | null
}

interface Agent {
  id: string
  name: string
  email: string
}

export default function AgentFeesPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [expenses, setExpenses] = useState<AgentExpense[]>([])
  const [agentStats, setAgentStats] = useState<AgentStats[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('30d')

  // New expense form state
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('')
  const [expenseType, setExpenseType] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [expenseDate, setExpenseDate] = useState('')
  const [saving, setSaving] = useState(false)

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
      const response = await fetch(`/api/finance/agent-fees?period=${period}`)
      if (response.ok) {
        const data = await response.json()
        setExpenses(data.expenses || [])
        setAgentStats(data.agentStats || [])
        setAgents(data.agents || [])
      }
    } catch (error) {
      console.error('Failed to fetch agent expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!selectedAgent) { toast.error('Please select an agent'); return }
    if (!expenseType) { toast.error('Please select an expense type'); return }
    if (!amount || parseFloat(amount) <= 0) { toast.error('Please enter a valid amount'); return }

    setSaving(true)
    try {
      const response = await fetch('/api/finance/agent-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent,
          type: expenseType,
          amount: parseFloat(amount),
          description,
          date: expenseDate
        })
      })

      if (response.ok) {
        toast.success('Expense saved successfully')
        fetchData()
        setAddExpenseOpen(false)
        setSelectedAgent('')
        setExpenseType('')
        setAmount('')
        setDescription('')
        setExpenseDate('')
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to save expense')
      }
    } catch (error) {
      console.error('Failed to add expense:', error)
      toast.error('Network error — please try again')
    } finally {
      setSaving(false)
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

  const totalExpenses = agentStats.reduce((sum, stat) => sum + (stat.totalExpenses || 0), 0)
  const avgExpenses = agentStats.length > 0 ? totalExpenses / agentStats.length : 0
  const highestExpense = agentStats.length > 0
    ? agentStats.reduce((max, stat) =>
        (stat.totalExpenses || 0) > (agentStats.find(s => s.agentId === max.agentId)?.totalExpenses || 0) ? stat : max,
        agentStats[0]
      )
    : null

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
            <h1 className="text-2xl font-bold tracking-tight">Call Center Agent Fees</h1>
            <p className="text-muted-foreground">
              Track and manage agent expenses
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
            <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Log Expense
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Agent Expense</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddExpense} className="space-y-4">
                  <div>
                    <Label>Agent</Label>
                    <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name} ({agent.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Expense Type</Label>
                    <Select value={expenseType} onValueChange={setExpenseType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Internet">Internet</SelectItem>
                        <SelectItem value="Call Minutes">Call Minutes</SelectItem>
                        <SelectItem value="Equipment">Equipment</SelectItem>
                        <SelectItem value="Transport">Transport</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Amount (XAF)</Label>
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Description (optional)</Label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What was this expense for?"
                    />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Expense'
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Agent Expenses</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(totalExpenses)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {agentStats.length} active agents
                  </p>
                </div>
                <div className="bg-red-100 dark:bg-red-900 p-3 rounded-full">
                  <DollarSign className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg per Agent</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(avgExpenses)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Monthly average
                  </p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                  <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Highest Expense</p>
                  <p className="text-2xl font-bold">
                    {highestExpense ? formatCurrency(highestExpense.totalExpenses || 0) : formatCurrency(0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {highestExpense ? agents.find(a => a.id === highestExpense.agentId)?.name : 'N/A'}
                  </p>
                </div>
                <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-full">
                  <FileText className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agent Stats Table */}
        <Card>
          <CardHeader>
            <CardTitle>Expense by Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium">Agent</th>
                    <th className="text-right py-2 px-4 font-medium">Total Expenses</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => {
                    const stat = agentStats.find(s => s.agentId === agent.id)
                    const total = stat?.totalExpenses || 0
                    return (
                      <tr key={agent.id} className="border-b">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium">{agent.name}</div>
                            <div className="text-sm text-muted-foreground">{agent.email}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={total > avgExpenses ? 'text-red-600 font-bold' : ''}>
                            {formatCurrency(total)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Expense History */}
        <Card>
          <CardHeader>
            <CardTitle>Expense History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium">Date</th>
                    <th className="text-left py-2 px-4 font-medium">Agent</th>
                    <th className="text-left py-2 px-4 font-medium">Type</th>
                    <th className="text-left py-2 px-4 font-medium">Description</th>
                    <th className="text-right py-2 px-4 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No expenses found for this period
                      </td>
                    </tr>
                  ) : (
                    expenses.map((expense) => (
                      <tr key={expense.id} className="border-b">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{formatDate(expense.incurredAt)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {expense.agent ? (
                            <div>
                              <div className="font-medium text-sm">{expense.agent.name}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs">
                            {expense.expenseType?.name || 'N/A'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {expense.description || '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-red-600">
                          -{formatCurrency(expense.amount)}
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
