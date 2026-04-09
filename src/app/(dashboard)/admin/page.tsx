'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Warehouse,
  Activity,
  ArrowRight,
  Phone,
  MoreHorizontal,
  Eye,
  Edit,
  X as CloseIcon
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Legend,
  Line,
  ReferenceLine
} from 'recharts'
import { cn } from '@/lib/utils'

interface DashboardData {
  stats: {
    totalOrders: number
    totalRevenue: number
    totalProfit?: number
    deliveryRate: number
    pendingOrders: number
    newOrders: number
    confirmedOrders: number
    shippedOrders: number
    deliveredOrders: number
    returnedOrders: number
    cancelledOrders: number
  }
  ordersPerDay: Array<{
    date: string
    total: number
    delivered: number
  }>
  cityStats: Record<string, { total: number; delivered: number }>
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
  usersCount: number
  activeUsersCount: number
  productsCount: number
  lowStockProducts: Array<{
    id: string
    sku: string
    name: string
    stock: number
    lowStockAlert: number
  }>
  onlineAgents?: Array<{
    id: string
    name: string
    email: string
    lastSeen: string | null
    isOnline: boolean
    currentWorkload: number
  }>
}

interface PreviousPeriodData {
  stats: {
    totalOrders: number
    totalRevenue: number
    totalProfit?: number
    deliveryRate: number
    pendingOrders: number
    newOrders: number
    confirmedOrders: number
    shippedOrders: number
    deliveredOrders: number
    returnedOrders: number
    cancelledOrders: number
  }
  ordersPerDay: Array<{
    date: string
    total: number
    delivered: number
  }>
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  NEW: { label: 'New', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/50', icon: <Clock className="h-3.5 w-3.5" /> },
  CONFIRMED: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200/50', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  SHIPPED: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200/50', icon: <Truck className="h-3.5 w-3.5" /> },
  DELIVERED: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200/50', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  RETURNED: { label: 'Returned', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200/50', icon: <XCircle className="h-3.5 w-3.5" /> },
  CANCELLED: { label: 'Cancelled', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200/50', icon: <XCircle className="h-3.5 w-3.5" /> }
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

type Period = 'today' | '7d' | '30d' | 'custom'

export default function AdminDashboard() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('30d')
  const [previousData, setPreviousData] = useState<PreviousPeriodData | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    if (!userLoading && (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN'))) {
      router.push('/login')
    }
  }, [user, userLoading, router])

  useEffect(() => {
    if (!user) return

    async function fetchData() {
      try {
        // Always fetch current and previous period data
        const { previousStart, previousEnd } = getPreviousPeriodDates()
        const requests = [
          fetch(`/api/dashboard?period=${period}`),
          fetch(`/api/dashboard?period=custom&dateFrom=${previousStart}&dateTo=${previousEnd}`)
        ]

        const responses = await Promise.all(requests)

        if (responses[0].ok) {
          setData(await responses[0].json())
          setLastUpdated(new Date())
        } else {
          // Set empty data on error to avoid null state
          setData({
            stats: {
              totalOrders: 0,
              totalRevenue: 0,
              totalProfit: 0,
              deliveryRate: 0,
              pendingOrders: 0,
              newOrders: 0,
              confirmedOrders: 0,
              shippedOrders: 0,
              deliveredOrders: 0,
              returnedOrders: 0,
              cancelledOrders: 0,
            },
            recentOrders: [],
            ordersPerDay: [],
            cityStats: {},
            usersCount: 0,
            activeUsersCount: 0,
            productsCount: 0,
            lowStockProducts: [],
          })
        }

        if (responses[1]?.ok) {
          setPreviousData(await responses[1].json())
        }
      } catch (error) {
        // Set empty data on error
        setData({
          stats: {
            totalOrders: 0,
            totalRevenue: 0,
            totalProfit: 0,
            deliveryRate: 0,
            pendingOrders: 0,
            newOrders: 0,
            confirmedOrders: 0,
            shippedOrders: 0,
            deliveredOrders: 0,
            returnedOrders: 0,
            cancelledOrders: 0,
          },
          recentOrders: [],
          ordersPerDay: [],
          cityStats: {},
          activeAgentsCount: 0,
          onCallAgentsCount: 0,
          pendingCODAmount: 0,
          lowStockProducts: [],
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user, period])

  const getPreviousPeriodDates = () => {
    const periodDays = period === 'today' ? 1 : period === '7d' ? 7 : 30
    const now = new Date()
    const periodStart = new Date(now)
    periodStart.setDate(now.getDate() - periodDays)
    const prevStart = new Date(periodStart)
    prevStart.setDate(prevStart.getDate() - periodDays)
    const prevEnd = new Date(periodStart)

    return {
      previousStart: prevStart.toISOString().split('T')[0],
      previousEnd: prevEnd.toISOString().split('T')[0]
    }
  }

  const calculatePercentChange = (current: number, previous: number): { value: number; label: string } => {
    if (!previous || previous === 0) {
      return { value: 0, label: 'N/A' }
    }
    const change = ((current - previous) / previous) * 100
    return {
      value: change,
      label: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
    }
  }

  if (userLoading || loading) {
    return (
      <>
        <div className="space-y-6 pb-10">
          {/* Skeleton KPI Cards */}
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="border-none bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-10 rounded-xl" />
                </CardHeader>
                <CardContent className="pb-3">
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Skeleton Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-none bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[340px]" />
              </CardContent>
            </Card>
            <Card className="border-none bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[340px]" />
              </CardContent>
            </Card>
          </div>

          {/* Skeleton Regional and Quick Metrics */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-none bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[340px]" />
              </CardContent>
            </Card>
            <Card className="border-none bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 mb-4" />
                <Skeleton className="h-24" />
              </CardContent>
            </Card>
          </div>

          {/* Skeleton Orders Table */}
          <Card className="border-none bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
            <CardHeader>
              <Skeleton className="h-7 w-40 mb-2" />
              <Skeleton className="h-8 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-80 w-full" />
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  if (!user || !data) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </>
    )
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GA', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(value)
  }

  const periodLabels: Record<Period, string> = {
    today: 'Today',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    custom: 'Custom'
  }

  const cityChartData = data?.cityStats
    ? Object.entries(data.cityStats)
        .map(([city, stats]) => ({
          city,
          total: stats.total,
          delivered: stats.delivered
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6)
    : []

  const statusChartData = [
    { name: 'New', value: data?.stats?.newOrders ?? 0, color: '#f59e0b' },
    { name: 'Confirmed', value: data?.stats?.confirmedOrders ?? 0, color: '#3b82f6' },
    { name: 'Shipped', value: data?.stats?.shippedOrders ?? 0, color: '#6366f1' },
    { name: 'Delivered', value: data?.stats?.deliveredOrders ?? 0, color: '#10b981' },
    { name: 'Returned', value: data?.stats?.returnedOrders ?? 0, color: '#ef4444' },
    { name: 'Cancelled', value: data?.stats?.cancelledOrders ?? 0, color: '#64748b' }
  ].filter(d => d.value > 0)

  return (
    <>
      {/* Low Stock Alerts Banner - Admin sees all alerts */}
      {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && <LowStockCriticalAlert showForAll={true} />}
      <div className="space-y-6 pb-10">
        {/* Enhanced Stats Cards - Now visible without scrolling */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          {/* Net Profit Card */}
          {data.stats.totalProfit !== undefined && (
            <Card className="group relative overflow-hidden transition-all hover:shadow-lg border-none bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
              <div className={cn(
                "absolute top-0 left-0 h-1 w-full",
                data.stats.totalProfit >= 0 ? "bg-indigo-500" : "bg-rose-500"
              )} />
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">Net profit</CardTitle>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0",
                        previousData?.stats?.totalProfit !== undefined && calculatePercentChange(data.stats.totalProfit, previousData.stats.totalProfit).value >= 0
                          ? "border-emerald-200 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50"
                          : "border-rose-200 text-rose-700 dark:text-rose-400 bg-rose-50/50"
                      )}
                    >
                      {previousData?.stats?.totalProfit !== undefined && calculatePercentChange(data.stats.totalProfit, previousData.stats.totalProfit).value >= 0 ? (
                        <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                      ) : (
                        <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />
                      )}
                      {previousData?.stats?.totalProfit !== undefined ? calculatePercentChange(data.stats.totalProfit, previousData.stats.totalProfit).label : '0%'}
                    </Badge>
                  </div>
                </div>
                <div className={cn(
                  "rounded-xl p-1.5 transition-transform group-hover:rotate-6",
                  data.stats.totalProfit >= 0
                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30"
                    : "bg-rose-50 text-rose-600 dark:bg-rose-900/30"
                )}>
                  <Activity className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className={cn(
                  "text-2xl font-bold tracking-tight",
                  data.stats.totalProfit >= 0 ? "text-slate-900 dark:text-white" : "text-rose-600"
                )}>
                  {formatCurrency(data.stats.totalProfit)}
                </div>
                <div className="mt-1 flex items-center text-[10px] font-medium text-slate-400">
                  {previousData?.stats?.totalProfit !== undefined
                    ? `vs ${formatCurrency(previousData.stats.totalProfit)} last period`
                    : 'Net after fulfillment costs'
                  }
                </div>
                {/* Sparkline */}
                {data.ordersPerDay.length > 1 && (
                  <div className="h-10 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.ordersPerDay}>
                        <Area
                          type="monotone"
                          dataKey="total"
                          stroke={data.stats.totalProfit >= 0 ? "#6366f1" : "#f43f5e"}
                          strokeWidth={1.5}
                          fill={data.stats.totalProfit >= 0 ? "url(#sparklineIndigo)" : "url(#sparklineRose)"}
                          fillOpacity={0.4}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Total Orders Card */}
          <Card className="group relative overflow-hidden transition-all hover:shadow-lg border-none bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
            <div className="absolute top-0 left-0 h-1 w-full bg-blue-500" />
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">Total orders</CardTitle>
                <div className="flex items-center gap-1 mt-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0",
                      previousData?.stats?.totalOrders !== undefined && calculatePercentChange(data.stats.totalOrders, previousData.stats.totalOrders).value >= 0
                        ? "border-emerald-200 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50"
                        : "border-rose-200 text-rose-700 dark:text-rose-400 bg-rose-50/50"
                    )}
                  >
                    {previousData?.stats?.totalOrders !== undefined && calculatePercentChange(data.stats.totalOrders, previousData.stats.totalOrders).value >= 0 ? (
                      <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                    ) : (
                      <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />
                    )}
                    {previousData?.stats?.totalOrders !== undefined ? calculatePercentChange(data.stats.totalOrders, previousData.stats.totalOrders).label : '0%'}
                  </Badge>
                </div>
              </div>
              <div className="rounded-xl bg-blue-50 p-1.5 text-blue-600 dark:bg-blue-900/30 transition-transform group-hover:rotate-6">
                <Package className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{data.stats.totalOrders.toLocaleString()}</div>
              <div className="mt-1 flex items-center text-[10px] font-medium text-slate-400">
                {previousData?.stats?.totalOrders !== undefined
                  ? `vs ${previousData.stats.totalOrders.toLocaleString()} last period`
                  : `${data.stats.pendingOrders} pending confirmation`
                }
              </div>
              {/* Sparkline */}
              {data.ordersPerDay.length > 1 && (
                <div className="h-10 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.ordersPerDay}>
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#3b82f6"
                        strokeWidth={1.5}
                        fill="url(#sparklineBlue)"
                        fillOpacity={0.4}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue Card */}
          <Card className="group relative overflow-hidden transition-all hover:shadow-lg border-none bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
            <div className="absolute top-0 left-0 h-1 w-full bg-emerald-500" />
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">Revenue</CardTitle>
                <div className="flex items-center gap-1 mt-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0",
                      previousData?.stats?.totalRevenue !== undefined && calculatePercentChange(data.stats.totalRevenue, previousData.stats.totalRevenue).value >= 0
                        ? "border-emerald-200 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50"
                        : "border-rose-200 text-rose-700 dark:text-rose-400 bg-rose-50/50"
                    )}
                  >
                    {previousData?.stats?.totalRevenue !== undefined && calculatePercentChange(data.stats.totalRevenue, previousData.stats.totalRevenue).value >= 0 ? (
                      <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                    ) : (
                      <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />
                    )}
                    {previousData?.stats?.totalRevenue !== undefined ? calculatePercentChange(data.stats.totalRevenue, previousData.stats.totalRevenue).label : '0%'}
                  </Badge>
                </div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-1.5 text-emerald-600 dark:bg-emerald-900/30 transition-transform group-hover:rotate-6">
                <DollarSign className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{formatCurrency(data.stats.totalRevenue)}</div>
              <div className="mt-1 flex items-center text-[10px] font-medium text-slate-400">
                {previousData?.stats?.totalRevenue !== undefined
                  ? `vs ${formatCurrency(previousData.stats.totalRevenue)} last period`
                  : 'From delivered orders'
                }
              </div>
              {/* Sparkline */}
              {data.ordersPerDay.length > 1 && (
                <div className="h-10 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.ordersPerDay}>
                      <Area
                        type="monotone"
                        dataKey="delivered"
                        stroke="#10b981"
                        strokeWidth={1.5}
                        fill="url(#sparklineGreen)"
                        fillOpacity={0.4}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Rate Card */}
          <Card className="group relative overflow-hidden transition-all hover:shadow-lg border-none bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
            <div className="absolute top-0 left-0 h-1 w-full bg-violet-500" />
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">Delivery rate</CardTitle>
                <div className="flex items-center gap-1 mt-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0",
                      previousData?.stats?.deliveryRate !== undefined && calculatePercentChange(data.stats.deliveryRate, previousData.stats.deliveryRate).value >= 0
                        ? "border-emerald-200 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50"
                        : "border-rose-200 text-rose-700 dark:text-rose-400 bg-rose-50/50"
                    )}
                  >
                    {previousData?.stats?.deliveryRate !== undefined && calculatePercentChange(data.stats.deliveryRate, previousData.stats.deliveryRate).value >= 0 ? (
                      <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                    ) : (
                      <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />
                    )}
                    {previousData?.stats?.deliveryRate !== undefined ? calculatePercentChange(data.stats.deliveryRate, previousData.stats.deliveryRate).label : '0%'}
                  </Badge>
                </div>
              </div>
              <div className="rounded-xl bg-violet-50 p-1.5 text-violet-600 dark:bg-violet-900/30 transition-transform group-hover:rotate-6">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{data.stats.deliveryRate}%</div>
              <div className="mt-1 flex items-center text-[10px] font-medium text-slate-400">
                <span className="text-violet-500">Target: 70%</span>
                <span className="mx-1">•</span>
                {previousData?.stats?.deliveryRate !== undefined
                  ? `vs ${previousData.stats.deliveryRate}% last period`
                  : `${data.stats.deliveredOrders} orders successful`
                }
              </div>
              {/* Sparkline with target line */}
              {data.ordersPerDay.length > 1 && (
                <div className="h-10 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.ordersPerDay}>
                      <defs>
                        <linearGradient id="sparklineViolet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey={(entry) => entry.total > 0 ? ((entry.delivered / entry.total) * 100) : 0}
                        stroke="#8b5cf6"
                        strokeWidth={1.5}
                        fill="url(#sparklineViolet)"
                        fillOpacity={0.4}
                        name="Daily rate"
                      />
                      <ReferenceLine y={70} stroke="#94a3b8" strokeDasharray="2 2" label="Target: 70%" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Return Rate Card - NEW */}
          <Card className={cn(
            "group relative overflow-hidden transition-all hover:shadow-lg border-none bg-white dark:bg-slate-900 shadow-sm ring-1",
            data.stats.returnedOrders / data.stats.totalOrders > 0.15
              ? "ring-rose-300 dark:ring-rose-800"
              : data.stats.returnedOrders / data.stats.totalOrders > 0.10
                ? "ring-amber-300 dark:ring-amber-800"
                : "ring-slate-200 dark:ring-slate-800"
          )}>
            <div className={cn(
              "absolute top-0 left-0 h-1 w-full",
              data.stats.returnedOrders / data.stats.totalOrders > 0.15
                ? "bg-rose-500"
                : data.stats.returnedOrders / data.stats.totalOrders > 0.10
                  ? "bg-amber-500"
                  : "bg-slate-400"
            )} />
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">Return rate</CardTitle>
                <div className="flex items-center gap-1 mt-1">
                  <Badge
                    variant={data.stats.returnedOrders / data.stats.totalOrders > 0.15 ? "destructive" : "outline"}
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0",
                      data.stats.returnedOrders / data.stats.totalOrders <= 0.15 && data.stats.returnedOrders / data.stats.totalOrders > 0.10
                        ? "border-amber-200 text-amber-700 dark:text-amber-400 bg-amber-50/50"
                        : data.stats.returnedOrders / data.stats.totalOrders <= 0.10
                          ? "border-emerald-200 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50"
                          : ""
                    )}
                  >
                    <span>{((data.stats.returnedOrders / data.stats.totalOrders) * 100).toFixed(1)}%</span>
                  </Badge>
                </div>
              </div>
              <div className={cn(
                "rounded-xl p-1.5 transition-transform group-hover:rotate-6",
                data.stats.returnedOrders / data.stats.totalOrders > 0.15
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-900/30"
                  : data.stats.returnedOrders / data.stats.totalOrders > 0.10
                    ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30"
                    : "bg-slate-50 text-slate-600 dark:bg-slate-800/30"
              )}>
                <XCircle className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {data.stats.returnedOrders} <span className="text-sm font-medium text-slate-400 ml-1">orders</span>
              </div>
              <div className="mt-1 flex items-center text-[10px] font-medium text-slate-400">
                {((data.stats.returnedOrders / data.stats.totalOrders) * 100).toFixed(1)}% of total orders
              </div>
              {/* Sparkline */}
              {data.ordersPerDay.length > 1 && (
                <div className="h-10 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.ordersPerDay}>
                      <defs>
                        <linearGradient id="sparklineRose" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey={(entry) => entry.total > 0 ? ((entry.returned || 0) / entry.total) * 100 : 0}
                        stroke="#f43f5e"
                        strokeWidth={1.5}
                        fill="url(#sparklineRose)"
                        fillOpacity={0.4}
                        name="Return rate"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Sparkline gradients */}
        <svg className="hidden">
          <defs>
            <linearGradient id="sparklineIndigo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="sparklineBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="sparklineGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="sparklineRose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
            </linearGradient>
          </defs>
        </svg>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Orders Trend */}
          <Card className="border-none bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">Orders Trend</CardTitle>
                  <CardDescription>
                    Current (solid) vs Previous period (dashed) — {periodLabels[period].toLowerCase()}
                  </CardDescription>
                </div>
                <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-slate-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[340px] w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.ordersPerDay} margin={{ top: 10, right: 10, left: 10, bottom: 35 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      axisLine={false}
                      tickLine={false}
                      className="text-[11px] font-medium text-slate-400"
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      className="text-[11px] font-medium text-slate-400"
                      label={{ value: 'Orders', angle: -90, position: 'insideLeft', style: { fontSize: '11px', fill: '#94a3b8' } }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(10px)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                      }}
                      itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                      labelStyle={{ fontSize: '11px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', color: '#64748b' }}
                    />
                    {/* Average reference line */}
                    {data.ordersPerDay.length > 0 && (
                      <ReferenceLine
                        y={data.ordersPerDay.reduce((sum, day) => sum + day.total, 0) / data.ordersPerDay.length}
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        label={{
                          value: `Avg: ${(data.ordersPerDay.reduce((sum, day) => sum + day.total, 0) / data.ordersPerDay.length).toFixed(0)}/day`,
                          position: 'topRight',
                          fill: '#94a3b8',
                          fontSize: 10
                        }}
                      />
                    )}
                    {/* Current Period Areas */}
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorTotal)"
                      name="Total Orders"
                    />
                    <Area
                      type="monotone"
                      dataKey="delivered"
                      stroke="#10b981"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorDelivered)"
                      name="Delivered"
                    />
                    {/* Previous Period Lines (dashed) */}
                    {previousData?.ordersPerDay && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="total"
                          data={previousData.ordersPerDay}
                          stroke="#6366f1"
                          strokeWidth={2}
                          strokeDasharray="5,5"
                          dot={false}
                          name="Total (Prev)"
                        />
                        <Line
                          type="monotone"
                          dataKey="delivered"
                          data={previousData.ordersPerDay}
                          stroke="#10b981"
                          strokeWidth={2}
                          strokeDasharray="5,5"
                          dot={false}
                          name="Delivered (Prev)"
                        />
                      </>
                    )}
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Order Status Distribution */}
          <Card className="border-none bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">Status Distribution</CardTitle>
                  <CardDescription>Breakdown by current state</CardDescription>
                </div>
                <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <MoreHorizontal className="h-4 w-4 text-slate-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-center p-6">
              <div className="flex items-center gap-8 h-[320px] w-full">
                {/* Donut Chart */}
                <div className="flex-1 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: 'none',
                          borderRadius: '12px',
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-slate-900 dark:text-white">{data.stats.totalOrders}</span>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-tighter">Total Orders</span>
                  </div>
                </div>

                {/* Side Legend */}
                <div className="w-36 space-y-2">
                  {statusChartData.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{entry.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">{entry.value}</div>
                        <div className="text-[10px] text-slate-400">
                          {((entry.value / data.stats.totalOrders) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* City Stats and Quick Overview */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Orders by City - Takes 2/3 */}
          <Card className="lg:col-span-2 border-none bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">Regional Performance</CardTitle>
                  <CardDescription>Top cities by order volume and delivery success</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cityChartData} layout="vertical" margin={{ left: 40, right: 70, top: 40, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                    <XAxis type="number" axisLine={false} tickLine={false} className="text-[11px] font-medium text-slate-400" />
                    <YAxis
                      dataKey="city"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase"
                      width={80}
                    />
                    <Tooltip
                      cursor={{ fill: '#f8fafc', opacity: 0.5 }}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Bar dataKey="total" fill="#6366f1" name="Total Orders" radius={[0, 4, 4, 0]} barSize={20}>
                      <labelList dataKey="total" position="right" fontSize={11} fill="#64748b" />
                    </Bar>
                    <Bar dataKey="delivered" fill="#10b981" name="Delivered" radius={[0, 4, 4, 0]} barSize={20}>
                      <labelList dataKey="delivered" position="right" fontSize={11} fill="#64748b" />
                    </Bar>
                    <Legend verticalAlign="top" align="left" height={36} iconType="circle" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Platform Metrics - Takes 1/3 */}
          <Card className="border-none bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">Quick Metrics</CardTitle>
                  <CardDescription>
                    {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* System Overview */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Users</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{data.usersCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="h-9 w-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600">
                    <Warehouse className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Products</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{data.productsCount}</p>
                  </div>
                </div>
              </div>

              {/* Live Operations */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Live Operations</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">New Orders</span>
                    </div>
                    <Badge className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30">{data.stats.newOrders}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-indigo-500" />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">In Transit</span>
                    </div>
                    <Badge className="rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30">{data.stats.shippedOrders}</Badge>
                  </div>
                </div>
              </div>

              {/* Online Agents */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Online Agents</p>
                <div className="space-y-2">
                  {data.onlineAgents && data.onlineAgents.length > 0 ? (
                    data.onlineAgents.map((agent) => (
                      <div key={agent.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "h-2 w-2 rounded-full",
                            agent.isOnline ? "bg-emerald-500" : "bg-slate-300"
                          )} />
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{agent.name}</span>
                            <span className="text-[10px] text-slate-400">{agent.email}</span>
                          </div>
                        </div>
                        <Badge variant={agent.isOnline ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {agent.isOnline ? "Online" : "Offline"}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-3">
                      <p className="text-xs text-slate-400">No call center agents configured</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders Table */}
        <Card className="border-none bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-4">
            <div>
              <CardTitle className="text-xl font-bold">Recent Logistics Activity</CardTitle>
              <CardDescription>Real-time view of the latest 10 orders</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.push('/orders')}
              className="rounded-xl border-slate-200 hover:bg-slate-50 transition-all"
            >
              Master List
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                    <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Tracking</th>
                    <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Client</th>
                    <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">Product Details</th>
                    <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Destination</th>
                    <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                    <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                    <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {data.recentOrders.map((order) => (
                    <tr 
                      key={order.id} 
                      className="group hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors"
                      onClick={() => router.push(`/orders/${order.id}`)}
                    >
                      <td className="py-4 px-6">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                          {order.trackingNumber}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">{order.customerName}</div>
                          <div className="text-xs text-slate-500 font-medium">{order.customerPhone}</div>
                        </div>
                      </td>
                      <td className="py-4 px-6 hidden md:table-cell">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{order.productName}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{order.city}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(order.codAmount)}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Badge className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                          statusConfig[order.status]?.color || ''
                        )}>
                          {statusConfig[order.status]?.icon}
                          {statusConfig[order.status]?.label || order.status}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {order.status === 'NEW' && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 px-3 text-xs font-medium bg-indigo-600 hover:bg-indigo-700"
                                onClick={(e) => { e.stopPropagation(); router.push(`/orders/${order.id}`); }}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={(e) => { e.stopPropagation(); window.open(`tel:${order.customerPhone}`); }}
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {order.status === 'SHIPPED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                              onClick={(e) => { e.stopPropagation(); router.push(`/orders/${order.id}`); }}
                            >
                              Track
                            </Button>
                          )}
                          {order.status === 'RETURNED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-3 text-xs font-medium border-amber-300 text-amber-700 hover:bg-amber-50"
                              onClick={(e) => { e.stopPropagation(); router.push(`/orders/${order.id}`); }}
                            >
                              Review
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" forceMount>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/orders/${order.id}`); }}>
                                <Eye className="mr-2 h-3.5 w-3.5" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                                <Edit className="mr-2 h-3.5 w-3.5" /> Edit Order
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-destructive">
                                <CloseIcon className="mr-2 h-3.5 w-3.5" /> Cancel Order
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.recentOrders.length === 0 && (
              <div className="py-20 text-center">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Package className="h-8 w-8 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium text-sm mb-4">No orders in the last 30 days</p>
                <Button
                  onClick={() => router.push('/orders')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  View all orders
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventory Critical Alerts */}
        {data.lowStockProducts.length > 0 && (
          <div className="grid gap-6">
            <div className="flex items-center gap-2 px-2">
              <AlertCircle className="h-5 w-5 text-rose-500" />
              <h2 className="text-lg font-bold tracking-tight">Critical Inventory Alerts</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.lowStockProducts.map((product) => (
                <div key={product.id} className="group relative overflow-hidden p-5 rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-rose-200 dark:ring-rose-900/50 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600">
                        <Warehouse className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[140px]">{product.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.sku}</p>
                      </div>
                    </div>
                    <Badge variant="destructive" className="rounded-full font-bold px-2.5">
                      {product.stock} units
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-500 rounded-full" 
                        style={{ width: `${Math.max(5, (product.stock / product.lowStockAlert) * 100)}%` }} 
                      />
                    </div>
                    <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 text-right uppercase tracking-tighter">
                      Critical: Below {product.lowStockAlert} threshold
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full mt-4 h-8 text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-indigo-600">
                    Restock Product
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
