'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DollarSign, TrendingUp, TrendingDown, Wallet, FileText } from 'lucide-react'

interface FinanceStats {
  totalRevenue: number
  totalCosts: number
  totalProfit: number
  deliveryRate: number
  ordersCount: number
  deliveredCount: number
  returnedCount: number
  pendingCOD: number
  collectedCOD: number
  costsBreakdown: { product: number; shipping: number; callCenter: number; adSpend: number }
}

export default function SellerFinancePage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [stats, setStats] = useState<FinanceStats | null>(null)
  const [period, setPeriod] = useState('30d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userLoading) return
    if (!user) { router.push('/login'); return }
    if (user.role !== 'SELLER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') { router.push('/unauthorized'); return }
  }, [user, userLoading, router])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetch(`/api/finance/stats?period=${period}`)
      .then(r => r.json())
      .then(setStats)
      .finally(() => setLoading(false))
  }, [user, period])

  const fmt = (v: number) =>
    new Intl.NumberFormat('fr-GA', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(v)

  if (userLoading || !user) return null

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="h-6 w-6" />My Finance</h1>
            <p className="text-muted-foreground">Your financial overview</p>
          </div>
          <div className="flex gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => router.push('/seller/finance/invoices')}>
              <FileText className="mr-2 h-4 w-4" /> Invoices
            </Button>
          </div>
        </div>

        {loading || !stats ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Revenue', value: fmt(stats.totalRevenue), icon: <TrendingUp className="h-5 w-5 text-green-600" />, sub: `${stats.deliveredCount} delivered` },
                { label: 'Costs', value: fmt(stats.totalCosts), icon: <TrendingDown className="h-5 w-5 text-red-600" />, sub: 'All expenses' },
                { label: 'Net Profit', value: fmt(stats.totalProfit), icon: <DollarSign className="h-5 w-5 text-blue-600" />, sub: `${stats.deliveryRate}% delivery rate` },
                { label: 'Pending COD', value: fmt(stats.pendingCOD), icon: <Wallet className="h-5 w-5 text-orange-500" />, sub: `Collected: ${fmt(stats.collectedCOD)}` }
              ].map(card => (
                <Card key={card.label}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                    {card.icon}
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{card.value}</div>
                    <p className="text-xs text-muted-foreground">{card.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader><CardTitle>Cost Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Product Cost', value: stats.costsBreakdown.product },
                    { label: 'Shipping', value: stats.costsBreakdown.shipping },
                    { label: 'Call Center', value: stats.costsBreakdown.callCenter },
                    { label: 'Ad Spend', value: stats.costsBreakdown.adSpend }
                  ].map(item => (
                    <div key={item.label} className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-bold text-sm">{fmt(item.value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
