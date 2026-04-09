'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUser } from '@/hooks/use-user'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  MapPin,
  Crown,
  Star,
  Truck
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from 'recharts'
import { format } from 'date-fns'

interface DashboardData {
  today: {
    totalOrders: number
    totalRevenue: number
    averageOrderValue: number
  }
  thisWeek: {
    totalOrders: number
    totalRevenue: number
    averageOrderValue: number
    percentChange: {
      orders: number
      revenue: number
      avgOrderValue: number
    }
  }
  thisMonth: {
    totalOrders: number
    totalRevenue: number
    averageOrderValue: number
    percentChange: {
      orders: number
      revenue: number
      avgOrderValue: number
    }
  }
  orderStats: {
    pending: number
    confirmed: number
    shipped: number
    delivered: number
    returned: number
    cancelled: number
    [key: string]: number
  }
  topSellingItems: Array<{
    productId: string
    productName: string
    quantitySold: number
    totalRevenue: number
  }>
  revenueChart: Array<{
    date: string
    revenue: number
  }>
}

interface AnalyticsData {
  sellers?: Array<{
    sellerId: string
    sellerName: string
    sellerEmail: string
    totalOrders: number
    deliveredOrders: number
    revenue: number
    netProfit: number
    deliveryRate: number
    averageOrderValue: number
  }>
  products?: Array<{
    productId: string
    productName: string
    totalQuantity: number
    deliveredQuantity: number
    totalRevenue: number
    averagePrice: number
    returnRate: number
  }>
  zones?: Array<{
    zoneId: string
    zoneName: string
    city: string
    totalOrders: number
    deliveredOrders: number
    returnedOrders: number
    deliveryRate: number
    totalRevenue: number
    driverName: string | null
  }>
  customers?: {
    totalCustomers: number
    newCustomers: number
    repeatCustomers: number
    repeatRate: number
    averageOrderValue: number
    topCustomers: Array<{
      phone: string
      orderCount: number
      totalSpent: number
      deliveredCount: number
      lastOrderDate: string
    }>
    customerLifetimeValue: number
  }
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  shipped: '#8b5cf6',
  delivered: '#10b981',
  returned: '#ef4444',
  cancelled: '#6b7280',
}

export default function AdminReportsPage() {
  const { user: session } = useUser()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    fetchDashboardData()
  }, [])

  useEffect(() => {
    if (activeTab !== 'overview') {
      fetchAnalyticsData()
    }
  }, [activeTab, period])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/reports/dashboard')
      if (response.ok) {
        const data = await response.json()
        setDashboardData(data)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAnalyticsData = async () => {
    setAnalyticsLoading(true)
    try {
      const type = activeTab === 'sellers' ? 'sellers' :
                   activeTab === 'products' ? 'products' :
                   activeTab === 'customers' ? 'customers' : 'zones'
      const response = await fetch(`/api/admin/analytics?period=${period}&type=${type}`)
      if (response.ok) {
        const data = await response.json()
        setAnalyticsData(data)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-GA', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const PercentChange = ({ value }: { value: number }) => {
    const isPositive = value >= 0
    return (
      <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        <span className="font-medium">{Math.abs(value).toFixed(1)}%</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-muted-foreground">Failed to load reports</div>
      </div>
    )
  }

  const orderStatusData = Object.entries(dashboardData.orderStats)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: status.replace('_', ' '),
      value: count,
      color: STATUS_COLORS[status] || '#6b7280'
    }))

  const revenueChartData = dashboardData.revenueChart.map(item => ({
    ...item,
    date: format(new Date(item.date), 'MMM d')
  }))

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Platform performance metrics and insights
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab !== 'overview' && (
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={activeTab === 'overview' ? fetchDashboardData : fetchAnalyticsData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {(session?.role === 'ADMIN' || session?.role === 'SUPER_ADMIN') && (
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sellers">Sellers</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="zones">Zones</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Today's Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.today.totalOrders}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboardData.today.totalRevenue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboardData.today.averageOrderValue)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Order Status Distribution</CardTitle>
                <CardDescription>Breakdown of current order statuses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={orderStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {orderStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Daily revenue for the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Selling Products</CardTitle>
              <CardDescription>Best sellers by quantity in the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.topSellingItems.map((item, index) => (
                  <div key={item.productId} className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{item.productName}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.quantitySold} sold • {formatCurrency(item.totalRevenue)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(item.totalRevenue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sellers Tab */}
        <TabsContent value="sellers">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : analyticsData?.sellers ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Seller Performance Ranking
                </CardTitle>
                <CardDescription>Top performing sellers by revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.sellers.slice(0, 20).map((seller, index) => (
                    <div key={seller.sellerId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{seller.sellerName}</div>
                          <div className="text-sm text-muted-foreground">{seller.sellerEmail}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-8 text-right">
                        <div>
                          <div className="text-sm text-muted-foreground">Orders</div>
                          <div className="font-semibold">{seller.deliveredOrders}/{seller.totalOrders}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Delivery Rate</div>
                          <div className="font-semibold">{seller.deliveryRate.toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Revenue</div>
                          <div className="font-semibold">{formatCurrency(seller.revenue)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Net Profit</div>
                          <div className="font-semibold">{formatCurrency(seller.netProfit)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No seller data available</div>
          )}
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : analyticsData?.products ? (
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Best Performing Products
                  </CardTitle>
                  <CardDescription>Top products by revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.products.filter(p => p.deliveredQuantity > 0).slice(0, 10).map((product) => (
                      <div key={product.productId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{product.productName}</div>
                          <div className="text-sm text-muted-foreground">
                            {product.deliveredQuantity} sold @ {formatCurrency(product.averagePrice)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(product.totalRevenue)}</div>
                          {product.returnRate > 0 && (
                            <Badge variant="destructive" className="text-xs">{product.returnRate.toFixed(1)}% return</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                    High Return Rate
                  </CardTitle>
                  <CardDescription>Products with high returns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.products
                      .filter(p => p.returnRate > 10)
                      .sort((a, b) => b.returnRate - a.returnRate)
                      .slice(0, 10)
                      .map((product) => (
                        <div key={product.productId} className="p-3 border rounded-lg">
                          <div className="font-medium text-sm truncate">{product.productName}</div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm text-muted-foreground">{product.deliveredQuantity} sold</span>
                            <Badge variant="destructive">{product.returnRate.toFixed(1)}% return</Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No product data available</div>
          )}
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : analyticsData?.customers ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsData.customers.totalCustomers}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">New Customers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{analyticsData.customers.newCustomers}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Repeat Customers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{analyticsData.customers.repeatCustomers}</div>
                    <div className="text-sm text-muted-foreground">{analyticsData.customers.repeatRate.toFixed(1)}% rate</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Avg. Lifetime Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(analyticsData.customers.customerLifetimeValue)}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-600" />
                    Top Customers
                  </CardTitle>
                  <CardDescription>Highest value customers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.customers.topCustomers.map((customer, index) => (
                      <div key={customer.phone} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{customer.phone}</div>
                            <div className="text-sm text-muted-foreground">
                              {customer.orderCount} orders • {customer.deliveredCount} delivered
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(customer.totalSpent)}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(customer.lastOrderDate), 'PP')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No customer data available</div>
          )}
        </TabsContent>

        {/* Zones Tab */}
        <TabsContent value="zones">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : analyticsData?.zones ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Zone Performance
                  </CardTitle>
                  <CardDescription>Orders and delivery by zone</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.zones.map((zone) => (
                      <div key={zone.zoneId} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{zone.zoneName}</div>
                          <Badge variant={zone.deliveryRate > 80 ? 'default' : zone.deliveryRate > 60 ? 'secondary' : 'destructive'}>
                            {zone.deliveryRate.toFixed(1)}% delivery
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Orders: </span>
                            <span className="font-medium">{zone.totalOrders}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Delivered: </span>
                            <span className="font-medium text-green-600">{zone.deliveredOrders}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Revenue: </span>
                            <span className="font-medium">{formatCurrency(zone.totalRevenue)}</span>
                          </div>
                        </div>
                        {zone.driverName && (
                          <div className="text-xs text-muted-foreground mt-2">
                            <Truck className="h-3 w-3 inline mr-1" />
                            Driver: {zone.driverName}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Zone Delivery Comparison</CardTitle>
                  <CardDescription>Revenue by zone</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.zones.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="zoneName" angle={-45} textAnchor="end" height={100} />
                        <YAxis tickFormatter={(value) => `${value / 1000}k`} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Bar dataKey="totalRevenue" fill="#3b82f6" name="Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No zone data available</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
