'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Wallet, 
  RefreshCcw, 
  CheckCircle2, 
  XCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  Users,
  CreditCard,
  Search,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface WalletEntry {
  id: string
  sellerId: string
  seller: { id: string; name: string; email: string }
  balance: number
  totalEarned: number
  totalDeducted: number
  pendingWithdrawals: number
  pendingAmount: number
  updatedAt: string
}

interface WithdrawalEntry {
  id: string
  amount: number
  status: string
  requestedAt: string
  note: string | null
  wallet: { seller: { id: string; name: string; email: string } }
}

export default function AdminWalletsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [wallets, setWallets] = useState<WalletEntry[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    if (!userLoading && !user) router.push('/login')
    if (!userLoading && user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') router.push('/unauthorized')
  }, [user, userLoading, router])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [walletsRes, withdrawalsRes] = await Promise.all([
        fetch('/api/wallet/all'),
        fetch('/api/wallet/withdrawals')
      ])
      if (walletsRes.ok) setWallets((await walletsRes.json()).wallets)
      if (withdrawalsRes.ok) setWithdrawals((await withdrawalsRes.json()).withdrawals)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') fetchData()
  }, [user])

  const processWithdrawal = async (id: string, status: 'PAID' | 'REJECTED') => {
    setProcessing(id)
    try {
      const res = await fetch('/api/wallet/withdrawals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(`Withdrawal ${status.toLowerCase()} successfully`, {
        description: status === 'PAID' ? 'The funds have been marked as transferred.' : 'The request has been declined.'
      })
      fetchData()
    } catch {
      toast.error('Failed to process withdrawal')
    } finally {
      setProcessing(null)
    }
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat('fr-GA', { 
      style: 'currency', 
      currency: 'XAF', 
      minimumFractionDigits: 0 
    }).format(v)

  if (userLoading || !user) return null

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-8 p-1">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary mb-1">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Wallet className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium tracking-wide uppercase">Financial Overview</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Seller Wallets</h1>
            <p className="text-muted-foreground max-w-2xl">
              Manage seller balances, monitor earnings, and process withdrawal requests across the platform.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchData}
              className="h-9 gap-2 border-muted-foreground/20 hover:bg-muted/50 transition-all"
            >
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Global Stats Grid (Derived) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-none bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Total Platform Balance</p>
                <div className="p-2 bg-primary/10 rounded-full">
                  <CreditCard className="h-4 w-4 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold">{fmt(wallets.reduce((acc, w) => acc + w.balance, 0))}</p>
            </CardContent>
          </Card>
          <Card className="border-none bg-card shadow-sm border border-muted/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Active Sellers</p>
                <div className="p-2 bg-blue-500/10 rounded-full">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-bold">{wallets.length}</p>
            </CardContent>
          </Card>
          <Card className="border-none bg-card shadow-sm border border-muted/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Pending Requests</p>
                <div className="p-2 bg-orange-500/10 rounded-full">
                  <Clock className="h-4 w-4 text-orange-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-orange-600">{withdrawals.length}</p>
            </CardContent>
          </Card>
          <Card className="border-none bg-card shadow-sm border border-muted/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Total Deductions</p>
                <div className="p-2 bg-red-500/10 rounded-full">
                  <ArrowDownRight className="h-4 w-4 text-red-600" />
                </div>
              </div>
              <p className="text-2xl font-bold">{fmt(wallets.reduce((acc, w) => acc + w.totalDeducted, 0))}</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Withdrawals Section */}
        {withdrawals.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                Action Required
              </h2>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 uppercase text-[10px] font-bold">
                {withdrawals.length} Pending
              </Badge>
            </div>
            <Card className="border-orange-100 shadow-md bg-orange-50/20 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="divide-y divide-orange-100/50">
                  {withdrawals.map(w => (
                    <div key={w.id} className="group px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-orange-50/50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold shrink-0 border border-orange-200">
                          {w.wallet.seller.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{w.wallet.seller.name}</p>
                          <p className="text-xs text-muted-foreground mb-1">{w.wallet.seller.email}</p>
                          {w.note && (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-orange-100 text-[11px] text-orange-800 italic mb-2">
                              "{w.note}"
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Requested on {new Date(w.requestedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <div className="text-right">
                          <p className="text-xl font-bold tracking-tight">{fmt(w.amount)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                            disabled={processing === w.id}
                            onClick={() => processWithdrawal(w.id, 'PAID')}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1.5" />
                            Confirm Payment
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all"
                            disabled={processing === w.id}
                            onClick={() => processWithdrawal(w.id, 'REJECTED')}
                          >
                            <XCircle className="h-4 w-4 mr-1.5" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* All Seller Balances Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <Users className="h-5 w-5 text-muted-foreground" />
              Seller Accounts
            </h2>
            <div className="relative group">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
               <input 
                 placeholder="Search sellers..." 
                 className="h-8 pl-9 pr-4 rounded-full bg-muted/40 border-none text-xs focus:ring-1 focus:ring-primary w-48 transition-all focus:w-64"
               />
            </div>
          </div>
          
          <Card className="border-muted/20 shadow-xl shadow-foreground/5 overflow-hidden">
            <div className="overflow-x-auto">
            <CardHeader className="bg-muted/30 border-b border-muted/20 py-4 px-6">
              <div className="grid grid-cols-12 text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-[600px]">
                <div className="col-span-6 lg:col-span-5">Seller Details</div>
                <div className="hidden lg:block lg:col-span-4 px-4 text-center">Lifetime Performance</div>
                <div className="col-span-6 lg:col-span-3 text-right">Current Balance</div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                  <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                  <p className="text-sm text-muted-foreground animate-pulse font-medium">Synchronizing financial records...</p>
                </div>
              ) : wallets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-muted/5">
                  <div className="p-4 bg-muted/20 rounded-full mb-4 text-muted-foreground">
                    <Wallet className="h-8 w-8" />
                  </div>
                  <p className="text-muted-foreground font-medium">No seller wallets detected</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">New wallets are created when sellers register.</p>
                </div>
              ) : (
                <div className="divide-y divide-muted/10">
                  {wallets.map(w => (
                    <div key={w.id} className="group px-6 py-4 grid grid-cols-12 items-center hover:bg-muted/10 transition-all cursor-default min-w-[600px]">
                      <div className="col-span-6 lg:col-span-5 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold transition-all group-hover:scale-110 group-hover:bg-primary group-hover:text-white">
                          {w.seller.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{w.seller.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{w.seller.email}</p>
                          {w.pendingWithdrawals > 0 && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="flex h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-tighter">
                                {w.pendingWithdrawals} Request Pending — {fmt(w.pendingAmount)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="hidden lg:grid col-span-4 grid-cols-2 gap-4 px-4 border-x border-muted/10">
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Total Earned</p>
                          <div className="flex items-center justify-center gap-1 text-green-600">
                             <ArrowUpRight className="h-3 w-3" />
                             <span className="text-xs font-bold leading-none">{fmt(w.totalEarned)}</span>
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Total Deducted</p>
                          <div className="flex items-center justify-center gap-1 text-red-500">
                             <ArrowDownRight className="h-3 w-3" />
                             <span className="text-xs font-bold leading-none">{fmt(w.totalDeducted)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-6 lg:col-span-3 text-right flex items-center justify-end gap-3">
                        <div className="space-y-0.5">
                          <p className="text-lg font-bold tabular-nums tracking-tight text-foreground">{fmt(w.balance)}</p>
                          <div className="flex lg:hidden flex-col items-end gap-0.5">
                             <span className="text-[10px] text-green-600 font-medium">+{fmt(w.totalEarned)} earned</span>
                             <span className="text-[10px] text-red-500 font-medium">-{fmt(w.totalDeducted)} deducted</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors translate-x-0 group-hover:translate-x-1" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
