'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  ArrowDownToLine, 
  RefreshCcw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  History,
  AlertCircle,
  Coins
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface WalletData {
  wallet: { id: string; balance: number; totalEarned: number; totalDeducted: number }
  transactions: Array<{ id: string; type: string; amount: number; description: string; createdAt: string }>
  withdrawals: Array<{ id: string; amount: number; status: string; requestedAt: string; note: string | null }>
}

const typeColors: Record<string, string> = {
  CREDIT: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  DEBIT: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  WITHDRAWAL: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  ADJUSTMENT: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  APPROVED: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  REJECTED: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  PAID: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
}

const statusIcons: Record<string, any> = {
  PENDING: Clock,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  PAID: CheckCircle2
}

export default function SellerWalletPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [data, setData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawNote, setWithdrawNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (!userLoading && !user) router.push('/login')
  }, [user, userLoading, router])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/wallet')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(withdrawAmount), note: withdrawNote })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('Withdrawal request submitted')
      setWithdrawAmount('')
      setWithdrawNote('')
      setShowForm(false)
      fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-GA', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(v)

  if (userLoading || !user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100">
                <Wallet className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider">Financial Overview</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Wallet</h1>
            <p className="text-slate-500 mt-1">Manage your earnings, withdrawals and transaction history.</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={fetchData}
              className="rounded-xl border-slate-200 hover:bg-slate-50 transition-all duration-200"
            >
              <RefreshCcw className={cn("h-4 w-4 text-slate-600", loading && "animate-spin")} />
            </Button>
            <Button 
              onClick={() => setShowForm(!showForm)}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all duration-200 gap-2"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Request Withdrawal
            </Button>
          </div>
        </div>

        {/* Balance Cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="relative overflow-hidden border-none bg-indigo-600 text-white shadow-xl shadow-indigo-600/10">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 bg-white/10 rounded-full blur-3xl" />
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                    <Coins className="h-6 w-6" />
                  </div>
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-md">Available</Badge>
                </div>
                <p className="text-indigo-100 text-sm font-medium">Available Balance</p>
                <p className="text-3xl font-bold mt-1 tracking-tight">{fmt(data.wallet.balance)}</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                    <TrendingUp className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
                <p className="text-slate-500 text-sm font-medium">Total Earned</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold text-slate-900">{fmt(data.wallet.totalEarned)}</p>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">Lifetime</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 rounded-xl bg-rose-50 border border-rose-100">
                    <TrendingDown className="h-6 w-6 text-rose-600" />
                  </div>
                </div>
                <p className="text-slate-500 text-sm font-medium">Total Deducted</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold text-slate-900">{fmt(data.wallet.totalDeducted)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Content: Transactions */}
          <div className="lg:col-span-8 space-y-8">
            {/* Withdrawal form - Inlined when active */}
            {showForm && (
              <Card className="border-indigo-200 bg-indigo-50/30 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-300">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-indigo-900">
                    <ArrowDownToLine className="h-5 w-5" />
                    Withdraw Funds
                  </CardTitle>
                  <CardDescription>Enter the amount you wish to withdraw to your registered payout method.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase text-slate-500 ml-1">Amount (XAF)</label>
                      <div className="relative">
                        <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={withdrawAmount}
                          onChange={e => setWithdrawAmount(e.target.value)}
                          className="pl-9 rounded-xl border-slate-200 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase text-slate-500 ml-1">Reference Note</label>
                      <Input
                        placeholder="Optional note"
                        value={withdrawNote}
                        onChange={e => setWithdrawNote(e.target.value)}
                        className="rounded-xl border-slate-200 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button 
                      onClick={handleWithdraw} 
                      disabled={submitting} 
                      className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 h-11"
                    >
                      {submitting ? 'Processing...' : 'Confirm Withdrawal'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => setShowForm(false)}
                      className="rounded-xl text-slate-500 hover:text-slate-900 h-11"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-slate-200/60 shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 py-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-slate-100">
                    <History className="h-4 w-4 text-slate-600" />
                  </div>
                  <CardTitle className="text-lg">Recent Transactions</CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-medium">View All</Button>
              </CardHeader>
              <CardContent className="p-0">
                {data?.transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="p-4 rounded-full bg-slate-50 mb-4">
                      <AlertCircle className="h-8 w-8 text-slate-300" />
                    </div>
                    <p className="text-slate-900 font-medium">No transactions found</p>
                    <p className="text-slate-500 text-sm">Your financial activity will appear here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {data?.transactions.map(t => (
                      <div key={t.id} className="group px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-2.5 rounded-xl border shadow-sm",
                            t.type === 'CREDIT' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-600"
                          )}>
                            {t.type === 'CREDIT' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{t.description}</p>
                              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 border", typeColors[t.type])}>
                                {t.type}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{new Date(t.createdAt).toLocaleDateString('en-GA', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                        </div>
                        <p className={cn(
                          "text-base font-bold tabular-nums",
                          t.type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-900'
                        )}>
                          {t.type === 'CREDIT' ? '+' : '-'}{fmt(t.amount).replace('XAF', '').trim()} <span className="text-[10px] font-medium text-slate-400">XAF</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: Withdrawals */}
          <div className="lg:col-span-4">
            <Card className="border-slate-200/60 shadow-sm overflow-hidden sticky top-8">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowDownToLine className="h-4 w-4 text-slate-500" />
                  Withdrawal Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data && data.withdrawals.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {data.withdrawals.map(w => {
                      const StatusIcon = statusIcons[w.status] || Clock
                      return (
                        <div key={w.id} className="px-5 py-4 hover:bg-slate-50/30 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-bold text-slate-900">{fmt(w.amount)}</p>
                            <Badge className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", statusColors[w.status])}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {w.status}
                            </Badge>
                          </div>
                          {w.note && (
                            <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 mb-2 italic">
                              "{w.note}"
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                            Requested: {new Date(w.requestedAt).toLocaleDateString()}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="py-12 px-6 text-center">
                    <p className="text-slate-400 text-sm">No withdrawal requests found.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
