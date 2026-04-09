'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Loader2, Trash2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUser } from '@/hooks/use-user'
import { toast } from 'sonner'

interface ExpenseType {
  id: string
  name: string
}

interface ExpenseItem {
  id: string
  category: string
  description: string | null
  amount: number
  incurredAt: string
  canDelete: boolean
}

interface ExpenseResponse {
  today: {
    total: number
    expenses: ExpenseItem[]
  }
  history: Array<{
    date: string
    total: number
    expenses: ExpenseItem[]
  }>
}

export default function ExpenseLogPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [types, setTypes] = useState<ExpenseType[]>([])
  const [expenses, setExpenses] = useState<ExpenseResponse | null>(null)
  const [expenseTypeId, setExpenseTypeId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!userLoading && !user) router.push('/login')
    if (!userLoading && user && user.role !== 'CALL_CENTER') router.push('/')
  }, [router, user, userLoading])

  useEffect(() => {
    if (!user || user.role !== 'CALL_CENTER') return

    async function load() {
      setLoading(true)
      try {
        const [typesRes, expensesRes] = await Promise.all([
          fetch('/api/expense-types', { cache: 'no-store' }),
          fetch('/api/expenses/my', { cache: 'no-store' })
        ])

        if (!typesRes.ok || !expensesRes.ok) {
          throw new Error('Failed to load expense log')
        }

        const typesData = await typesRes.json()
        setTypes(typesData.expenseTypes || [])
        setExpenses(await expensesRes.json())
      } catch (error) {
        console.error(error)
        toast.error('Failed to load expense log')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  const reloadExpenses = async () => {
    const response = await fetch('/api/expenses/my', { cache: 'no-store' })
    if (!response.ok) {
      throw new Error('Failed to reload expenses')
    }
    setExpenses(await response.json())
  }

  const handleSubmit = async () => {
    const selectedType = types.find((item) => item.id === expenseTypeId)
    if (!selectedType || !amount) return

    setSubmitting(true)
    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenseTypeId,
          category: selectedType.name,
          amount,
          description
        })
      })

      if (!response.ok) {
        throw new Error('Failed to log expense')
      }

      setExpenseTypeId('')
      setAmount('')
      setDescription('')
      await reloadExpenses()
      toast.success('Expense logged!')
    } catch (error) {
      console.error(error)
      toast.error('Failed to log expense')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error('Failed to delete expense')
      }
      await reloadExpenses()
      toast.success('Expense deleted')
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete expense')
    }
  }

  if (userLoading || loading || !expenses) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f8f8]">
        <Loader2 className="h-8 w-8 animate-spin text-[#f07020]" />
      </div>
    )
  }

  if (!user || user.role !== 'CALL_CENTER') return null

  return (
    <>
      <div className="space-y-5 font-sora">
        <div>
          <h1 className="text-[24px] font-bold text-[#111111]">Expense Log</h1>
          <p className="text-[12px] text-[#666666]">Track agent transport, meals, call minutes, and daily operating expenses.</p>
        </div>

        <Card className="rounded-[10px] border border-[#e5e5e5] bg-white py-0 shadow-none">
          <CardHeader className="border-b border-[#efefef] px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-[15px] text-[#111111]">
              <Wallet className="h-4 w-4 text-[#f07020]" />
              Log Expense
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 px-5 py-5 md:grid-cols-[1.1fr_0.8fr_1.2fr_auto]">
            <Select value={expenseTypeId} onValueChange={setExpenseTypeId}>
              <SelectTrigger className="h-11 rounded-xl border-[#e5e5e5] bg-white text-[12px] focus:ring-[#f07020]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {types.map((type) => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-11 rounded-xl border-[#e5e5e5] bg-white text-[12px] focus-visible:ring-[#f07020]"
            />
            <Input
              placeholder="Describe the expense..."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="h-11 rounded-xl border-[#e5e5e5] bg-white text-[12px] focus-visible:ring-[#f07020]"
            />
            <Button
              onClick={handleSubmit}
              disabled={!expenseTypeId || !amount || submitting}
              className="h-11 rounded-xl bg-[#f07020] px-5 text-[12px] font-bold text-white hover:bg-[#d96500]"
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Log Expense
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[10px] border border-[#e5e5e5] bg-white py-0 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[#efefef] px-5 py-4">
            <CardTitle className="text-[15px] text-[#111111]">Today&apos;s Expenses</CardTitle>
            <div className="text-[12px] font-semibold text-[#111111]">
              Total: FCFA {Math.round(expenses.today.total).toLocaleString('fr-FR')}
            </div>
          </CardHeader>
          <CardContent className="px-5 py-4">
            {expenses.today.expenses.length === 0 ? (
              <div className="text-[12px] text-[#888888]">No expenses logged today.</div>
            ) : (
              <div className="space-y-2">
                {expenses.today.expenses.map((expense) => (
                  <div key={expense.id} className="grid grid-cols-[0.7fr_1fr_1.6fr_0.8fr_auto] items-center gap-3 rounded-xl border border-[#efefef] bg-[#fcfcfc] px-4 py-3 text-[12px]">
                    <div className="text-[#666666]">{format(new Date(expense.incurredAt), 'HH:mm')}</div>
                    <div className="font-medium text-[#111111]">{expense.category}</div>
                    <div className="truncate text-[#666666]">{expense.description || '-'}</div>
                    <div className="font-semibold text-[#dc2626]">-{Math.round(expense.amount).toLocaleString('fr-FR')} XAF</div>
                    {expense.canDelete ? (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(expense.id)} className="h-8 w-8 rounded-lg text-[#888888] hover:bg-[#fff1e8] hover:text-[#dc2626]">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : <div />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[10px] border border-[#e5e5e5] bg-white py-0 shadow-none">
          <CardHeader className="border-b border-[#efefef] px-5 py-4">
            <CardTitle className="text-[15px] text-[#111111]">Past Expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-5 py-4">
            {expenses.history.map((group) => (
              <div key={group.date} className="rounded-xl border border-[#efefef] bg-[#fcfcfc] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[13px] font-semibold text-[#111111]">
                    {format(new Date(group.date), 'MMMM d, yyyy')}
                  </div>
                  <div className="text-[12px] text-[#666666]">
                    Total: FCFA {Math.round(group.total).toLocaleString('fr-FR')}
                  </div>
                </div>
                <div className="space-y-2">
                  {group.expenses.map((expense) => (
                    <div key={expense.id} className="grid grid-cols-[0.7fr_1fr_1.6fr_0.8fr] gap-3 border-t border-[#efefef] py-2 text-[12px] first:border-t-0 first:pt-0">
                      <div className="text-[#666666]">{format(new Date(expense.incurredAt), 'HH:mm')}</div>
                      <div className="font-medium text-[#111111]">{expense.category}</div>
                      <div className="text-[#666666]">{expense.description || '-'}</div>
                      <div className="font-semibold text-[#dc2626]">-{Math.round(expense.amount).toLocaleString('fr-FR')}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
