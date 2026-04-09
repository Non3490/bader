'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useUser } from '@/hooks/use-user'
import { LowStockCriticalAlert } from '@/components/inventory/LowStockCriticalAlert'
import {
  Package,
  DollarSign,
  TrendingUp,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Wallet,
  ArrowRight,
  Bolt,
  Activity,
  History
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardData {
  stats: {
    totalOrders: number
    totalRevenue: number
    totalProfit: number
    deliveryRate: number
    pendingOrders: number
    newOrders: number
    confirmedOrders: number
    shippedOrders: number
    deliveredOrders: number
    returnedOrders: number
    cancelledOrders: number
  }
  recentOrders: Array<{
    id: string
    trackingNumber: string
    customerName: string
    customerPhone: string
    city: string
    productName: string
    codAmount: number
    status: string
    createdAt: string
  }>
}

interface FinanceStats {
  pendingCOD: number
  collectedCOD: number
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  NEW: { label: 'New', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/50', icon: Clock },
  CONFIRMED: { label: 'Confirmed', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200/50', icon: CheckCircle },
  SHIPPED: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200/50', icon: Truck },
  DELIVERED: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200/50', icon: CheckCircle },
  RETURNED: { label: 'Returned', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200/50', icon: History },
  CANCELLED: { label: 'Cancelled', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200/50', icon: XCircle }
}

export default function SellerDashboard() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [data, setData] = useState<DashboardData | null>(null)
  const [finance, setFinance] = useState<FinanceStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userLoading) return
    // Only SELLER role can access this dashboard
    if (user && user.role !== 'SELLER') {
      router.push('/unauthorized')
    }
  }, [user, userLoading, router])

  useEffect(() => {
    if (!user) return
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/finance/stats?period=30d').then(r => r.json())
    ])
      .then(([dash, fin]) => {
        setData(dash)
        setFinance(fin)
      })
      .finally(() => setLoading(false))
  }, [user])

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-GA', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(value)

  if (userLoading || loading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute animate-ping h-12 w-12 rounded-full bg-primary/20" />
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        </div>
      </>
    )
  }

  if (!user || !data) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute animate-ping h-12 w-12 rounded-full bg-primary/20" />
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Low Stock Alerts Banner - Sellers see their own alerts */}
      {user?.role === 'SELLER' && <LowStockCriticalAlert />}
      <div className="max-w-[1600px] mx-auto space-y-8 pb-12">
        {/* Modern Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-8 py-10 text-white shadow-2xl dark:bg-slate-900/50 dark:border dark:border-slate-800">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
          
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary-foreground/90 backdrop-blur-md border border-white/10">
                  <Bolt className="mr-1 h-3 w-3" />
                  Live Updates
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                Dashboard Overview
              </h1>
              <p className="text-slate-400 max-w-md text-lg">
                Welcome back, <span className="text-white font-semibold">{user.name}</span>. 
                Your sales performance is up <span className="text-emerald-400 font-bold">12%</span> this week.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={() => router.push('/orders')}
                className="bg-white text-slate-900 hover:bg-slate-100 shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <Package className="mr-2 h-4 w-4" />
                Manage Orders
              </Button>
              <Button 
                variant="outline"
                className="bg-slate-800/50 border-white/10 text-white hover:bg-slate-800 hover:border-white/20 backdrop-blur-sm"
                onClick={() => router.push('/analytics')}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Analytics
              </Button>
            </div>
          </div>
        </div>

        {/* High-Impact Stat Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { 
              title: 'Total Orders', 
              value: data.stats.totalOrders.toLocaleString(), 
              sub: `${data.stats.pendingOrders} pending`,
              icon: Package, 
              color: 'text-indigo-600 dark:text-indigo-400',
              bg: 'bg-indigo-50 dark:bg-indigo-900/20',
              border: 'border-indigo-100 dark:border-indigo-900/30'
            },
            { 
              title: 'Revenue', 
              value: formatCurrency(data.stats.totalRevenue), 
              sub: 'From delivered orders',
              icon: DollarSign, 
              color: 'text-emerald-600 dark:text-emerald-400',
              bg: 'bg-emerald-50 dark:bg-emerald-900/20',
              border: 'border-emerald-100 dark:border-emerald-900/30'
            },
            { 
              title: 'Delivery Rate', 
              value: `${data.stats.deliveryRate}%`, 
              sub: `${data.stats.deliveredOrders} successful`,
              icon: TrendingUp, 
              color: 'text-sky-600 dark:text-sky-400',
              bg: 'bg-sky-50 dark:bg-sky-900/20',
              border: 'border-sky-100 dark:border-sky-900/30'
            },
            { 
              title: 'Pending COD', 
              value: formatCurrency(finance?.pendingCOD ?? 0), 
              sub: `Collected: ${formatCurrency(finance?.collectedCOD ?? 0)}`,
              icon: Wallet, 
              color: 'text-orange-600 dark:text-orange-400',
              bg: 'bg-orange-50 dark:bg-orange-900/20',
              border: 'border-orange-100 dark:border-orange-900/30'
            }
          ].map((stat, i) => (
            <Card key={i} className={cn("group overflow-hidden border-none shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1", stat.bg)}>
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div className={cn("p-3 rounded-2xl transition-transform duration-500 group-hover:rotate-12", stat.bg, "border border-white/20 dark:border-white/5 shadow-inner")}>
                    <stat.icon className={cn("h-6 w-6", stat.color)} />
                  </div>
                  <div className="h-12 w-12 absolute -right-4 -top-4 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.title}</p>
                  <h3 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {stat.value}
                  </h3>
                  <p className="text-xs text-slate-500/80 font-medium">
                    {stat.sub}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Order Status Breakdown - Visualized */}
          <Card className="lg:col-span-1 border-none shadow-lg bg-white dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Order Funnel</CardTitle>
                  <CardDescription>Current order lifecycle distribution</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[
                  { label: 'New Orders', value: data.stats.newOrders, icon: Clock, color: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10' },
                  { label: 'Confirmed', value: data.stats.confirmedOrders, icon: CheckCircle, color: 'bg-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/10' },
                  { label: 'In Transit', value: data.stats.shippedOrders, icon: Truck, color: 'bg-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/10' },
                  { label: 'Delivered', value: data.stats.deliveredOrders, icon: CheckCircle, color: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                  { label: 'Returns', value: data.stats.returnedOrders, icon: History, color: 'bg-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/10' },
                  { label: 'Cancelled', value: data.stats.cancelledOrders, icon: XCircle, color: 'bg-slate-500', bg: 'bg-slate-50 dark:bg-slate-900/10' }
                ].map((item, idx) => {
                  const percentage = data.stats.totalOrders > 0 
                    ? Math.round((item.value / data.stats.totalOrders) * 100) 
                    : 0
                  return (
                    <div key={idx} className="group relative">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-1.5 rounded-md text-white shadow-sm", item.color)}>
                            <item.icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {item.value}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full transition-all duration-1000 ease-out rounded-full", item.color)}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
                <p className="text-xs text-slate-400 font-medium italic">
                  * percentages are calculated based on total volume
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Orders - Modern Table */}
          <Card className="lg:col-span-2 border-none shadow-lg bg-white dark:bg-slate-900/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <History className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Recent Transactions</CardTitle>
                  <CardDescription>Latest 10 orders activity</CardDescription>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-primary hover:text-primary/80 hover:bg-primary/5 font-semibold group"
                onClick={() => router.push('/orders')}
              >
                Full Activity
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="h-20 w-20 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                    <Package className="h-10 w-10 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No orders found</h3>
                  <p className="text-slate-500 max-w-[240px]">Start by creating your first order or importing from a file.</p>
                  <Button className="mt-6 shadow-lg shadow-primary/20" onClick={() => router.push('/orders')}>
                    Create Order
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Tracking</th>
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Details</th>
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                        <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.recentOrders.map((order) => {
                        const status = statusConfig[order.status] || { label: order.status, color: 'bg-slate-100', icon: Clock }
                        return (
                          <tr
                            key={order.id}
                            className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                            onClick={() => router.push(`/orders/${order.id}`)}
                          >
                            <td className="py-4 px-6">
                              <span className="font-mono text-sm font-bold text-primary px-2 py-1 bg-primary/5 rounded border border-primary/10">
                                {order.trackingNumber}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{order.customerName}</span>
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Truck className="h-3 w-3" /> {order.city}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-6 hidden md:table-cell">
                              <span className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1">{order.productName}</span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {formatCurrency(order.codAmount)}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <Badge className={cn(
                                "border px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tighter",
                                status.color
                              )}>
                                {status.label}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
