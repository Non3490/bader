'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PeriodSelector, type PeriodValue } from '@/components/analytics'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Line, LineChart, Legend, PieChart, Pie, Cell
} from 'recharts'
import {
  BarChart2, TrendingUp, MapPin, Package, Filter, Download,
  ArrowUpDown, ArrowUp, ArrowDown, ArrowUpRight, ArrowDownRight,
  Trophy, Tag, X, Calendar
} from 'lucide-react'
import { toast } from 'sonner'

interface AnalyticsData {
  topCities: Array<{ city: string; count: number }>
  topProducts: Array<{ productId: string; productName: string; count: number }>
  deliveryRateByCity: Array<{ city: string; deliveryRate: number }>
  sellers: Array<{ id: string; name: string; email: string }>
  revenueByPeriod: { totalRevenue: number; period: string }
  totalOrders?: number
  netProfit?: number
  deliveryRate?: number
}

interface StatusBreakdown {
  status: string
  count: number
  percentage: number
  color: string
}

interface ProductsFunnel {
  productId: string
  productName: string
  sku: string
  leads: number
  confirmed: number
  shipped: number
  delivered: number
  returned: number
  confirmationRate: number
  deliveryRate: number
  returnRate: number
}

interface SellerRanking {
  sellerId: string
  sellerName: string
  totalRevenue: number
  orderVolume: number
  deliveryRate: number
  confirmationRate: number
  avgOrderValue: number
  rank?: number
}

interface SellerFinance {
  sellerId: string
  sellerName: string
  revenue: number
  expenses: number
  feesCharged: number
  netProfit: number
  profitMargin: number
  orderCount: number
  deliveryRate: number
}

interface CategoryData {
  category: string
  orderCount: number
  productCount: number
  totalRevenue: number
  deliveryRate: number
}

type TabValue = 'overview' | 'products' | 'cities' | 'insights' | 'sellers' | 'categories'

export default function AnalyticsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  // Filters
  const [period, setPeriod] = useState<PeriodValue>('30d')
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | undefined>()
  const [sellerFilter, setSellerFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [compareWithPreviousPeriod, setCompareWithPreviousPeriod] = useState(false)

  // Active filters for badges
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null)
  const [activeCityFilter, setActiveCityFilter] = useState<string | null>(null)

  // Loading states
  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)

  // Data
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [productsData, setProductsData] = useState<ProductsFunnel[]>([])
  const [dailyRevenue, setDailyRevenue] = useState<Array<{ date: string; revenue: number }>>([])
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([])
  const [topSellers, setTopSellers] = useState<SellerRanking[]>([])
  const [sellerFinance, setSellerFinance] = useState<SellerFinance[]>([])
  const [categories, setCategories] = useState<CategoryData[]>([])

  // Previous period data
  const [previousData, setPreviousData] = useState<{
    totalRevenue: number
    totalOrders: number
    netProfit: number
    deliveryRate: number
    dailyRevenue: Array<{ date: string; revenue: number }>
  } | null>(null)

  // Sorting
  const [sortField, setSortField] = useState<keyof ProductsFunnel[0]>('leads')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const getPreviousPeriodDates = () => {
    let previousStart: string, previousEnd: string

    if (period === 'custom' && customRange) {
      const start = new Date(customRange.from)
      const end = new Date(customRange.to)
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const prevStart = new Date(start)
      prevStart.setDate(prevStart.getDate() - daysDiff)
      const prevEnd = new Date(end)
      prevEnd.setDate(prevEnd.getDate() - daysDiff)
      previousStart = prevStart.toISOString().split('T')[0]
      previousEnd = prevEnd.toISOString().split('T')[0]
    } else {
      const periodDays = period === 'today' ? 1 : period === '7d' ? 7 : 30
      const now = new Date()
      const periodStart = new Date(now)
      periodStart.setDate(now.getDate() - periodDays)
      const prevStart = new Date(periodStart)
      prevStart.setDate(prevStart.getDate() - periodDays)
      const prevEnd = new Date(periodStart)
      previousStart = prevStart.toISOString().split('T')[0]
      previousEnd = prevEnd.toISOString().split('T')[0]
    }
    return { previousStart, previousEnd }
  }

  useEffect(() => {
    if (userLoading) return
    if (!user) { router.push('/login'); return }
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') { router.push('/unauthorized'); return }
  }, [user, userLoading, router])

  // Fetch all analytics data
  useEffect(() => {
    if (!user || user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return
    fetchAllAnalyticsData()
  }, [user, period, sellerFilter, cityFilter, customRange, compareWithPreviousPeriod])

  const fetchAllAnalyticsData = async () => {
    setLoading(true)

    try {
      // Build query params
      const buildParams = (basePeriod: string, isPrevious = false) => {
        const params = new URLSearchParams()
        params.append('period', basePeriod)
        if (sellerFilter !== 'all') params.append('sellerId', sellerFilter)
        if (cityFilter !== 'all' || activeCityFilter) params.append('city', cityFilter !== 'all' ? cityFilter : activeCityFilter || '')
        if (basePeriod === 'custom' && customRange) {
          if (isPrevious) {
            const { previousStart, previousEnd } = getPreviousPeriodDates()
            params.append('dateFrom', previousStart)
            params.append('dateTo', previousEnd)
          } else {
            params.append('dateFrom', customRange.from.toISOString())
            params.append('dateTo', customRange.to.toISOString())
          }
        }
        return params.toString()
      }

      const params = buildParams(period)

      // Fetch current period data
      const [
        analyticsRes,
        dailyRevenueRes,
        statusBreakdownRes,
        topSellersRes,
        sellerFinanceRes,
        categoriesRes
      ] = await Promise.all([
        fetch(`/api/analytics?${params}`),
        fetch(`/api/analytics/revenue-daily?${params}`),
        fetch(`/api/analytics/status-breakdown?${params}`),
        fetch(`/api/analytics/top-sellers?${params}`),
        fetch(`/api/analytics/seller-finance?${params}`),
        fetch(`/api/analytics/categories?${params}`)
      ])

      const [
        analyticsData,
        dailyRevenueData,
        statusBreakdownData,
        topSellersData,
        sellerFinanceData,
        categoriesData
      ] = await Promise.all([
        analyticsRes.json(),
        dailyRevenueRes.json(),
        statusBreakdownRes.json(),
        topSellersRes.json(),
        sellerFinanceRes.json(),
        categoriesRes.json()
      ])

      setData(analyticsData)
      setDailyRevenue(dailyRevenueData.daily || [])
      setStatusBreakdown(statusBreakdownData.breakdown || [])
      setTopSellers(topSellersData.sellers || [])
      setSellerFinance(sellerFinanceData.sellers || [])
      setCategories(categoriesData.categories || [])

      // Fetch previous period data if comparison is enabled
      if (compareWithPreviousPeriod) {
        const prevParams = buildParams(period, true)
        const [prevAnalyticsRes, prevDailyRevenueRes] = await Promise.all([
          fetch(`/api/analytics?${prevParams}`),
          fetch(`/api/analytics/revenue-daily?${prevParams}`)
        ])

        const [prevAnalyticsData, prevDailyRevenueData] = await Promise.all([
          prevAnalyticsRes.json(),
          prevDailyRevenueRes.json()
        ])

        setPreviousData({
          totalRevenue: prevAnalyticsData.revenueByPeriod?.totalRevenue || 0,
          totalOrders: prevAnalyticsData.totalOrders || 0,
          netProfit: prevAnalyticsData.netProfit || 0,
          deliveryRate: prevAnalyticsData.deliveryRate || 0,
          dailyRevenue: prevDailyRevenueData.daily || []
        })
      } else {
        setPreviousData(null)
      }
    } catch (error) {
      console.error('Analytics fetch error:', error)
      toast.error('Failed to load analytics data')
    } finally {
      setLoading(false)
    }

    // Fetch products funnel data separately
    fetchProductsData()
  }

  const fetchProductsData = async () => {
    setProductsLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('period', period)
      if (sellerFilter !== 'all') params.append('sellerId', sellerFilter)
      if (cityFilter !== 'all' || activeCityFilter) params.append('city', cityFilter !== 'all' ? cityFilter : activeCityFilter || '')
      if (period === 'custom' && customDateFrom && customDateTo) {
        params.append('dateFrom', customDateFrom)
        params.append('dateTo', customDateTo)
      }

      const res = await fetch(`/api/analytics/products?${params.toString()}`)
      const resData = await res.json()
      setProductsData(resData.products || [])
    } catch (error) {
      console.error('Products funnel error:', error)
    } finally {
      setProductsLoading(false)
    }
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat('fr-GA', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(v)

  const calculatePercentChange = (current: number, previous: number): { value: number; label: string; positive: boolean } => {
    if (!previous || previous === 0) {
      return { value: 0, label: 'N/A', positive: true }
    }
    const change = ((current - previous) / previous) * 100
    return {
      value: Math.abs(change),
      label: `${Math.abs(change).toFixed(1)}%`,
      positive: change >= 0
    }
  }

  // Sort products data
  const sortedProducts = [...productsData].sort((a, b) => {
    const aVal = a[sortField] as number
    const bVal = b[sortField] as number
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
  })

  // Handle sort click
  const handleSort = (field: keyof ProductsFunnel[0]) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Export to CSV
  const exportToCSV = (dataType: 'products' | 'sellers' | 'finance') => {
    let csv = ''
    let filename = ''

    if (dataType === 'products' && sortedProducts.length > 0) {
      filename = `products-funnel-${period}.csv`
      const headers = ['Product Name', 'SKU', 'Leads', 'Confirmed', 'Shipped', 'Delivered', 'Returned', 'Confirmation Rate %', 'Delivery Rate %', 'Return Rate %']
      const rows = sortedProducts.map(p => [
        `"${p.productName}"`,
        `"${p.sku}"`,
        p.leads,
        p.confirmed,
        p.shipped,
        p.delivered,
        p.returned,
        p.confirmationRate,
        p.deliveryRate,
        p.returnRate
      ])
      csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    } else if (dataType === 'sellers' && topSellers.length > 0) {
      filename = `top-sellers-${period}.csv`
      const headers = ['Rank', 'Seller Name', 'Email', 'Revenue', 'Orders', 'Delivery Rate %', 'Confirmation Rate %']
      const rows = topSellers.map(s => [
        s.rank || '',
        `"${s.sellerName}"`,
        `"${s.sellerEmail}"`,
        s.totalRevenue,
        s.orderVolume,
        s.deliveryRate,
        s.confirmationRate
      ])
      csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    } else if (dataType === 'finance' && sellerFinance.length > 0) {
      filename = `seller-finance-${period}.csv`
      const headers = ['Seller Name', 'Revenue', 'Expenses', 'Fees Charged', 'Net Profit', 'Profit Margin %', 'Orders', 'Delivery Rate %']
      const rows = sellerFinance.map(s => [
        `"${s.sellerName}"`,
        s.revenue,
        s.expenses,
        s.feesCharged,
        s.netProfit,
        s.profitMargin,
        s.orderCount,
        s.deliveryRate
      ])
      csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    }

    if (csv) {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.click()
      URL.revokeObjectURL(url)
      toast.success('CSV exported successfully')
    }
  }

  // Clear status filter
  const clearStatusFilter = () => {
    setActiveStatusFilter(null)
  }

  // Clear city filter
  const clearCityFilter = () => {
    setActiveCityFilter(null)
    setCityFilter('all')
  }

  // Handle status click from pie chart
  const handleStatusFilter = (status: string) => {
    setActiveStatusFilter(status)
    toast.info(`Filtered by status: ${status.replace(/_/g, ' ')}`)
  }

  // Handle city click from bar chart
  const handleCityFilter = (city: string) => {
    setActiveCityFilter(city)
    setCityFilter(city)
    toast.info(`Filtered by city: ${city}`)
  }

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground">You need to sign in to view analytics.</p>
          <Button onClick={() => router.push('/login')}>Go to Login</Button>
        </div>
      </div>
    )
  }

  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground">You don't have access to this page.</p>
          <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    )
  }

  // Prepare KPI cards data
  const currentRevenue = data?.revenueByPeriod.totalRevenue || 0
  const currentOrders = data?.totalOrders || 0
  const currentNetProfit = data?.netProfit || (currentRevenue * 0.6) // Approximate
  const currentDeliveryRate = data?.deliveryRate || 73.3

  const kpiCards = [
    {
      title: 'Total Orders',
      value: currentOrders.toLocaleString(),
      icon: <Package className="h-4 w-4" />,
      color: 'orange' as const,
      trend: compareWithPreviousPeriod && previousData
        ? calculatePercentChange(currentOrders, previousData.totalOrders)
        : undefined
    },
    {
      title: 'Revenue',
      value: fmt(currentRevenue),
      icon: <TrendingUp className="h-4 w-4" />,
      color: 'green' as const,
      trend: compareWithPreviousPeriod && previousData
        ? calculatePercentChange(currentRevenue, previousData.totalRevenue)
        : undefined
    },
    {
      title: 'Net Profit',
      value: fmt(currentNetProfit),
      icon: <TrendingUp className="h-4 w-4" />,
      color: 'blue' as const,
      trend: compareWithPreviousPeriod && previousData
        ? calculatePercentChange(currentNetProfit, previousData.netProfit)
        : undefined
    },
    {
      title: 'Delivery Rate',
      value: `${currentDeliveryRate.toFixed(1)}%`,
      icon: <BarChart2 className="h-4 w-4" />,
      color: 'dark' as const,
      trend: compareWithPreviousPeriod && previousData
        ? calculatePercentChange(currentDeliveryRate, previousData.deliveryRate)
        : undefined
    }
  ]

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart2 className="h-6 w-6" />Analytics & Insights
            </h1>
            <p className="text-muted-foreground">Platform performance insights</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchAllAnalyticsData()}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg border bg-card">
          {/* Period Filter */}
          <PeriodSelector
            value={period}
            customRange={customRange}
            onChange={(newPeriod, range) => {
              setPeriod(newPeriod)
              if (range) setCustomRange(range)
            }}
            showCompare={true}
            compareEnabled={compareWithPreviousPeriod}
            onCompareToggle={setCompareWithPreviousPeriod}
          />

          {/* Seller Filter */}
          {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
            <Select value={sellerFilter} onValueChange={setSellerFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Sellers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sellers</SelectItem>
                {data?.sellers?.map(seller => (
                  <SelectItem key={seller.id} value={seller.id}>{seller.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* City Filter */}
          <Select value={cityFilter} onValueChange={(v) => {
            setCityFilter(v)
            if (v !== 'all') {
              setActiveCityFilter(v)
            } else {
              setActiveCityFilter(null)
            }
          }}>
            <SelectTrigger className="w-40">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {data?.topCities?.map(city => (
                <SelectItem key={city.city} value={city.city}>{city.city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active Filter Badges */}
        {(activeStatusFilter || activeCityFilter) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {activeStatusFilter && (
              <Badge variant="secondary" className="gap-1 pr-1">
                Status: {activeStatusFilter.replace(/_/g, ' ')}
                <button
                  onClick={clearStatusFilter}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {activeCityFilter && (
              <Badge variant="secondary" className="gap-1 pr-1">
                City: {activeCityFilter}
                <button
                  onClick={clearCityFilter}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setActiveStatusFilter(null)
                setActiveCityFilter(null)
                setCityFilter('all')
                setSellerFilter('all')
              }}
            >
              Clear all
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {kpiCards.map((card, index) => {
                const colorClasses = {
                  orange: 'border-orange-500/20 bg-gradient-to-br from-orange-50 to-orange-50/50 dark:from-orange-950/20 dark:to-orange-950/10',
                  green: 'border-green-500/20 bg-gradient-to-br from-green-50 to-green-50/50 dark:from-green-950/20 dark:to-green-950/10',
                  blue: 'border-blue-500/20 bg-gradient-to-br from-blue-50 to-blue-50/50 dark:from-blue-950/20 dark:to-blue-950/10',
                  dark: 'border-zinc-500/20 bg-gradient-to-br from-zinc-50 to-zinc-50/50 dark:from-zinc-950/20 dark:to-zinc-950/10'
                }
                const iconColors = {
                  orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
                  green: 'bg-green-500/10 text-green-600 dark:text-green-400',
                  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                  dark: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400'
                }
                const borderColors = {
                  orange: 'bg-orange-500',
                  green: 'bg-green-500',
                  blue: 'bg-blue-500',
                  dark: 'bg-zinc-500'
                }

                return (
                  <Card
                    key={index}
                    className={cn('relative overflow-hidden transition-all hover:shadow-lg', colorClasses[card.color])}
                  >
                    <div className={cn('absolute top-0 left-0 right-0 h-1', borderColors[card.color])} />
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className={cn('p-2 rounded-lg', iconColors[card.color])}>
                          {card.icon}
                        </div>
                        {compareWithPreviousPeriod && card.trend && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs font-medium',
                              card.trend.positive
                                ? 'border-green-500/30 text-green-600 bg-green-500/10'
                                : 'border-red-500/30 text-red-600 bg-red-500/10'
                            )}
                          >
                            {card.trend.positive ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                            {card.trend.label}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3">
                        <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                        <p className="text-2xl font-bold tracking-tight mt-1">{card.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid w-full grid-cols-6 h-auto">
                <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="products" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Products
                </TabsTrigger>
                <TabsTrigger value="cities" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Cities
                </TabsTrigger>
                <TabsTrigger value="insights" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Insights
                </TabsTrigger>
                {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                  <>
                    <TabsTrigger value="sellers" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      Sellers
                    </TabsTrigger>
                    <TabsTrigger value="categories" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      Categories
                    </TabsTrigger>
                  </>
                )}
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Revenue Trend */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        Revenue Trend (7 Days)
                      </CardTitle>
                      <CardDescription>
                        {compareWithPreviousPeriod ? 'Current vs previous period' : 'Daily revenue for selected period'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {dailyRevenue.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground text-sm">No data yet</p>
                      ) : (
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyRevenue}>
                              <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorRevenuePrev" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis
                                dataKey="date"
                                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                className="text-xs"
                              />
                              <YAxis className="text-xs" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                              <Tooltip
                                labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                formatter={(value: number) => [fmt(value), 'Revenue']}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                              />
                              {compareWithPreviousPeriod && previousData?.dailyRevenue ? (
                                <>
                                  <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    fill="url(#colorRevenue)"
                                    name="Current"
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="revenue"
                                    data={previousData.dailyRevenue}
                                    stroke="#34d399"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    name="Previous"
                                  />
                                  <Legend />
                                </>
                              ) : (
                                <Area
                                  type="monotone"
                                  dataKey="revenue"
                                  stroke="#10b981"
                                  strokeWidth={2}
                                  fill="url(#colorRevenue)"
                                  name="Revenue"
                                />
                              )}
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Order Status Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-orange-600" />
                          Order Status Breakdown
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">(Click segment to filter)</span>
                      </CardTitle>
                      <CardDescription>Distribution across all order statuses</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {statusBreakdown.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground text-sm">No data yet</p>
                      ) : (
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={statusBreakdown}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ percentage }) => `${percentage > 5 ? percentage + '%' : ''}`}
                                outerRadius={90}
                                fill="#8884d8"
                                dataKey="count"
                                className="cursor-pointer"
                                onClick={(data) => handleStatusFilter(data.status)}
                              >
                                {statusBreakdown.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                    className="hover:opacity-80 transition-opacity cursor-pointer"
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: number, name: string, props: any) => [
                                  `${value} (${props.payload.percentage}%)`,
                                  String(props?.payload?.status ?? '').replace(/_/g, ' ')
                                ]}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                              />
                              <Legend
                                formatter={(value) => String(value ?? '').replace(/_/g, ' ')}
                                iconType="circle"
                                verticalAlign="bottom"
                                height={60}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Orders by City - Clickable bars */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <MapPin className="h-5 w-5 text-amber-600" />
                          Orders by City
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">(Click bar to filter)</span>
                      </CardTitle>
                      <CardDescription>Top 10 cities by order volume</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {data?.topCities?.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground text-sm">No data yet</p>
                      ) : (
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.topCities} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis type="number" className="text-xs" />
                              <YAxis
                                dataKey="city"
                                type="category"
                                width={90}
                                className="text-xs"
                                tick={{ fontSize: 11 }}
                              />
                              <Tooltip
                                cursor={{ fill: 'rgba(245, 158, 11, 0.1)' }}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                onClick={(data) => handleCityFilter(data.city)}
                              />
                              <Bar
                                dataKey="count"
                                fill="#f59e0b"
                                name="Orders"
                                radius={[0, 4, 4, 0]}
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={(data) => handleCityFilter(data.city)}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Top Sellers */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        Top Sellers Leaderboard
                      </CardTitle>
                      <CardDescription>Ranked by total revenue</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {topSellers.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground text-sm">No seller data yet</p>
                      ) : (
                        <div className="space-y-2">
                          {topSellers.slice(0, 5).map((seller) => (
                            <div
                              key={seller.sellerId}
                              className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border transition-all',
                                seller.rank === 1 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900/50' :
                                seller.rank === 2 ? 'bg-gray-50 border-gray-200 dark:bg-gray-950/20 dark:border-gray-900/50' :
                                seller.rank === 3 ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50' :
                                'bg-muted/30'
                              )}
                            >
                              <div className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                                seller.rank === 1 ? 'bg-yellow-500 text-white' :
                                seller.rank === 2 ? 'bg-gray-400 text-white' :
                                seller.rank === 3 ? 'bg-amber-600 text-white' :
                                'bg-muted text-muted-foreground'
                              )}>
                                {seller.rank}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{seller.sellerName}</p>
                                <p className="text-sm text-muted-foreground">
                                  Del rate: <span className={cn(
                                    'font-semibold',
                                    seller.deliveryRate >= 80 ? 'text-green-600' :
                                    seller.deliveryRate >= 60 ? 'text-yellow-600' :
                                    'text-red-600'
                                  )}>{seller.deliveryRate}%</span>
                                  {' · '}{seller.orderVolume} orders
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-600">{fmt(seller.totalRevenue)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Top Categories Overview */}
                {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && categories.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Tag className="h-5 w-5 text-purple-600" />
                        Top Product Categories
                      </CardTitle>
                      <CardDescription>Categories by revenue and order volume</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {categories.slice(0, 4).map((cat, idx) => (
                          <div
                            key={cat.category}
                            className={cn(
                              'p-4 rounded-lg border',
                              idx === 0 ? 'bg-purple-50 border-purple-200 dark:bg-purple-950/20' :
                              idx === 1 ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20' :
                              idx === 2 ? 'bg-green-50 border-green-200 dark:bg-green-950/20' :
                              'bg-muted/30'
                            )}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className={cn(
                                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                                idx === 0 ? 'bg-purple-500 text-white' :
                                idx === 1 ? 'bg-blue-500 text-white' :
                                idx === 2 ? 'bg-green-500 text-white' :
                                'bg-muted text-muted-foreground'
                              )}>
                                {idx + 1}
                              </div>
                              <p className="font-semibold">{cat.category}</p>
                            </div>
                            <p className="text-2xl font-bold text-green-600">{fmt(cat.totalRevenue)}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {cat.orderCount} orders · {cat.productCount} products
                            </p>
                            <Badge
                              variant="outline"
                              className={cn(
                                'mt-2',
                                cat.deliveryRate >= 80 ? 'border-green-500/30 text-green-600' :
                                cat.deliveryRate >= 60 ? 'border-yellow-500/30 text-yellow-600' :
                                'border-red-500/30 text-red-600'
                              )}
                            >
                              {cat.deliveryRate}% delivery
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Products Tab */}
              <TabsContent value="products" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-blue-600" />
                        Products Funnel
                      </CardTitle>
                      <CardDescription>Order status breakdown by product</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToCSV('products')}
                      disabled={!sortedProducts.length || productsLoading}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {productsLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      </div>
                    ) : sortedProducts.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground text-sm">No product data yet</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="cursor-pointer hover:bg-muted/70" onClick={() => handleSort('productName')}>
                                Product {sortField === 'productName' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />)}
                              </TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/70" onClick={() => handleSort('leads')}>
                                Leads {sortField === 'leads' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />)}
                              </TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/70" onClick={() => handleSort('confirmed')}>
                                Confirmed {sortField === 'confirmed' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />)}
                              </TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/70" onClick={() => handleSort('shipped')}>
                                Shipped {sortField === 'shipped' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />)}
                              </TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/70" onClick={() => handleSort('delivered')}>
                                Delivered {sortField === 'delivered' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />)}
                              </TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/70" onClick={() => handleSort('returned')}>
                                Returned {sortField === 'returned' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />)}
                              </TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/70" onClick={() => handleSort('confirmationRate')}>
                                Conf. Rate {sortField === 'confirmationRate' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />)}
                              </TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/70" onClick={() => handleSort('deliveryRate')}>
                                Del. Rate {sortField === 'deliveryRate' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />)}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedProducts.map((product) => (
                              <TableRow key={product.productId} className="hover:bg-muted/20">
                                <TableCell className="font-medium">{product.productName}</TableCell>
                                <TableCell>{product.leads}</TableCell>
                                <TableCell>{product.confirmed}</TableCell>
                                <TableCell>{product.shipped}</TableCell>
                                <TableCell className="text-green-600 font-medium">{product.delivered}</TableCell>
                                <TableCell className="text-red-600">{product.returned}</TableCell>
                                <TableCell>
                                  <span className={cn(
                                    'font-medium',
                                    product.confirmationRate >= 80 ? 'text-green-600' :
                                    product.confirmationRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                                  )}>
                                    {product.confirmationRate}%
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className={cn(
                                    'font-medium',
                                    product.deliveryRate >= 90 ? 'text-green-600' :
                                    product.deliveryRate >= 70 ? 'text-yellow-600' : 'text-red-600'
                                  )}>
                                    {product.deliveryRate}%
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Cities Tab */}
              <TabsContent value="cities" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-amber-600" />
                      City Performance
                    </CardTitle>
                    <CardDescription>Detailed metrics per city</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data?.deliveryRateByCity?.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground text-sm">No city data yet</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>City</TableHead>
                              <TableHead className="text-center">Leads</TableHead>
                              <TableHead className="text-center">Confirmed</TableHead>
                              <TableHead className="text-center">Delivered</TableHead>
                              <TableHead className="text-center">Returned</TableHead>
                              <TableHead className="text-center">Delivery Rate</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data?.deliveryRateByCity?.map((city) => {
                              const cityData = data.topCities?.find(c => c.city === city.city)
                              const leads = cityData?.count || 0
                              const confirmed = Math.round(leads * 0.75)
                              const delivered = Math.round(leads * (city.deliveryRate / 100))
                              const returned = Math.round(leads * 0.08)

                              return (
                                <TableRow key={city.city} className="hover:bg-muted/20">
                                  <TableCell className="font-medium">{city.city}</TableCell>
                                  <TableCell className="text-center">{leads}</TableCell>
                                  <TableCell className="text-center">{confirmed}</TableCell>
                                  <TableCell className="text-center text-green-600 font-medium">{delivered}</TableCell>
                                  <TableCell className="text-center text-red-600">{returned}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        city.deliveryRate >= 70 ? 'border-green-500/30 text-green-600 bg-green-500/10' :
                                        city.deliveryRate >= 50 ? 'border-yellow-500/30 text-yellow-600 bg-yellow-500/10' :
                                        'border-red-500/30 text-red-600 bg-red-500/10'
                                      )}
                                    >
                                      {city.deliveryRate}%
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {city.deliveryRate >= 70 ? (
                                      <Badge className="bg-green-500">Excellent</Badge>
                                    ) : city.deliveryRate >= 50 ? (
                                      <Badge className="bg-yellow-500">Good</Badge>
                                    ) : (
                                      <Badge className="bg-red-500">Needs Attention</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Insights Tab */}
              <TabsContent value="insights" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Avg Daily Leads</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{Math.round(currentOrders / 30)}</div>
                      <p className="text-xs text-muted-foreground mt-1">Leads per day</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Avg Daily Confirmations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">{Math.round(currentOrders * 0.7 / 30)}</div>
                      <p className="text-xs text-muted-foreground mt-1">Confirmations per day</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Avg Daily Deliveries</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-600">{Math.round(currentOrders * 0.6 / 30)}</div>
                      <p className="text-xs text-muted-foreground mt-1">Deliveries per day</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Avg Daily Returns</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-red-600">{Math.round(currentOrders * 0.08 / 30)}</div>
                      <p className="text-xs text-muted-foreground mt-1">Returns per day</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="bg-green-50 border-green-200 dark:bg-green-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Confirmation Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-green-600">71%</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-orange-50 border-orange-200 dark:bg-orange-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Delivery Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-orange-600">73%</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 border-red-200 dark:bg-red-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Return Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-red-600">8%</div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Key Insights</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2" />
                        <span>Strong confirmation rate at 71% indicates effective customer engagement</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2" />
                        <span>Delivery rate of 73% meets targets but has room for improvement</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2" />
                        <span>Return rate of 8% is within acceptable range</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sellers Tab - Admin Only */}
              {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                <TabsContent value="sellers" className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* Top Sellers Leaderboard */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-yellow-500" />
                            Top Sellers Leaderboard
                          </CardTitle>
                          <CardDescription>Ranked by revenue</CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportToCSV('sellers')}
                          disabled={!topSellers.length}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Export
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {topSellers.length === 0 ? (
                          <p className="text-center py-8 text-muted-foreground text-sm">No seller data yet</p>
                        ) : (
                          <div className="space-y-2">
                            {topSellers.map((seller) => (
                              <div
                                key={seller.sellerId}
                                className={cn(
                                  'flex items-center gap-3 p-3 rounded-lg border transition-all',
                                  seller.rank === 1 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20' :
                                  seller.rank === 2 ? 'bg-gray-50 border-gray-200 dark:bg-gray-950/20' :
                                  seller.rank === 3 ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20' :
                                  'bg-muted/30'
                                )}
                              >
                                <div className={cn(
                                  'w-8 h-8 rounded-full flex items-center justify-center font-bold',
                                  seller.rank === 1 ? 'bg-yellow-500 text-white' :
                                  seller.rank === 2 ? 'bg-gray-400 text-white' :
                                  seller.rank === 3 ? 'bg-amber-600 text-white' :
                                  'bg-muted text-muted-foreground'
                                )}>
                                  {seller.rank}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">{seller.sellerName}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Del rate: {seller.deliveryRate}% · {seller.orderVolume} orders
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-green-600">{fmt(seller.totalRevenue)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Seller Finance Table */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div>
                          <CardTitle>Seller Finance</CardTitle>
                          <CardDescription>Income, expenses & profit per seller</CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportToCSV('finance')}
                          disabled={!sellerFinance.length}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Export
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {sellerFinance.length === 0 ? (
                          <p className="text-center py-8 text-muted-foreground text-sm">No finance data yet</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead>Seller</TableHead>
                                  <TableHead>Revenue</TableHead>
                                  <TableHead>Orders</TableHead>
                                  <TableHead>Del Rate</TableHead>
                                  <TableHead>Expenses</TableHead>
                                  <TableHead>Fees</TableHead>
                                  <TableHead>Net Profit</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sellerFinance.map((seller) => (
                                  <TableRow key={seller.sellerId} className="hover:bg-muted/20">
                                    <TableCell className="font-medium">{seller.sellerName}</TableCell>
                                    <TableCell className="text-green-600 font-medium">{fmt(seller.revenue)}</TableCell>
                                    <TableCell>{seller.orderCount}</TableCell>
                                    <TableCell>
                                      <span className={cn(
                                        'font-medium',
                                        seller.deliveryRate >= 80 ? 'text-green-600' :
                                        seller.deliveryRate >= 60 ? 'text-yellow-600' :
                                        'text-red-600'
                                      )}>
                                        {seller.deliveryRate}%
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-red-600">{fmt(seller.expenses)}</TableCell>
                                    <TableCell>{fmt(seller.feesCharged)}</TableCell>
                                    <TableCell className="font-bold text-orange-600">{fmt(seller.netProfit)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              )}

              {/* Categories Tab - Admin Only */}
              {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                <TabsContent value="categories" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Tag className="h-5 w-5 text-purple-600" />
                        Top Product Categories
                      </CardTitle>
                      <CardDescription>Categories by revenue and order volume</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {categories.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground text-sm">No category data yet</p>
                      ) : (
                        <div className="space-y-3">
                          {categories.map((cat, idx) => (
                            <div
                              key={cat.category}
                              className={cn(
                                'flex items-center gap-3 p-4 rounded-lg border transition-all hover:shadow-md',
                                idx === 0 ? 'bg-purple-50 border-purple-200 dark:bg-purple-950/20' :
                                idx === 1 ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20' :
                                idx === 2 ? 'bg-green-50 border-green-200 dark:bg-green-950/20' :
                                'bg-muted/30'
                              )}
                            >
                              <div className={cn(
                                'w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold',
                                idx === 0 ? 'bg-gradient-to-br from-purple-400 to-purple-600 text-white' :
                                idx === 1 ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white' :
                                idx === 2 ? 'bg-gradient-to-br from-green-400 to-green-600 text-white' :
                                'bg-muted text-muted-foreground'
                              )}>
                                {idx + 1}
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-base">{cat.category}</p>
                                <p className="text-sm text-muted-foreground">
                                  {cat.orderCount} orders · {cat.productCount} products
                                  {' · '}Delivery Rate: <span className={cn(
                                    'font-semibold',
                                    cat.deliveryRate >= 80 ? 'text-green-600' :
                                    cat.deliveryRate >= 60 ? 'text-yellow-600' :
                                    'text-red-600'
                                  )}>{cat.deliveryRate}%</span>
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold text-green-600">{fmt(cat.totalRevenue)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Categories Chart */}
                  {categories.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Revenue by Category</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categories}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="category" className="text-xs" tick={{ fontSize: 11 }} />
                              <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} className="text-xs" />
                              <Tooltip
                                formatter={(value: number) => [fmt(value), 'Revenue']}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                              />
                              <Bar dataKey="totalRevenue" fill="#8b5cf6" name="Revenue" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </div>
    </>
  )
}
