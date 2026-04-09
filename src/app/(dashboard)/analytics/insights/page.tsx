'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, 
  Package, 
  CheckCircle, 
  XCircle, 
  RefreshCcw, 
  DollarSign, 
  MapPin, 
  ArrowUpRight,
  Activity,
  Target
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts'

interface InsightsData {
  summary: {
    totalOrders: number
    delivered: number
    returned: number
    totalRevenue: number
    deliveryRate: number
    returnRate: number
    avgOrderValue: number
    avgDailyOrders: number
  }
  daily: Array<{ date: string; orders: number; delivered: number; revenue: number }>
  cityPerformance: Array<{ city: string; orders: number; revenue: number }>
}

export default function InsightsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userLoading && !user) router.push('/login')
  }, [user, userLoading, router])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics/insights')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-GA', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(v)

  if (userLoading || !user) return null

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 border border-border p-3 rounded-xl shadow-xl backdrop-blur-md">
          <p className="text-xs font-medium mb-2 text-muted-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-foreground">{entry.name}:</span>
              <span className="ml-auto">{entry.value}</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <>
      <div className="max-w-[1200px] mx-auto space-y-8 animate-in fade-in duration-700">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/50 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <TrendingUp className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="rounded-full px-3 font-medium bg-background">Analytics Dashboard</Badge>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Business Insights
            </h1>
            <p className="text-muted-foreground mt-1 text-base">
              Comprehensive 30-day performance analysis and market trends.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="rounded-xl h-11 px-4 hover:bg-secondary transition-all shadow-sm"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Sync Data
            </Button>
            <Button className="rounded-xl h-11 px-4 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20">
              Export Report
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
              <Activity className="h-5 w-5 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-muted-foreground font-medium animate-pulse">Aggregating real-time insights...</p>
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { 
                  label: 'Total Orders', 
                  value: data.summary.totalOrders, 
                  sub: `~${data.summary.avgDailyOrders}/day avg`, 
                  icon: Package, 
                  color: 'indigo' 
                },
                { 
                  label: 'Delivery Rate', 
                  value: `${data.summary.deliveryRate}%`, 
                  sub: `${data.summary.delivered} completed`, 
                  icon: CheckCircle, 
                  color: 'emerald' 
                },
                { 
                  label: 'Return Rate', 
                  value: `${data.summary.returnRate}%`, 
                  sub: `${data.summary.returned} attempts`, 
                  icon: XCircle, 
                  color: 'rose' 
                },
                { 
                  label: 'Net Revenue', 
                  value: fmt(data.summary.totalRevenue), 
                  sub: `${fmt(data.summary.avgOrderValue)} avg/order`, 
                  icon: DollarSign, 
                  color: 'amber' 
                }
              ].map((stat, i) => (
                <Card key={i} className="relative overflow-hidden group border-border/50 hover:border-indigo-500/30 transition-all duration-300 shadow-sm hover:shadow-xl">
                  <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full bg-${stat.color}-500/5 blur-2xl group-hover:bg-${stat.color}-500/10 transition-all`} />
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-2.5 rounded-xl bg-${stat.color}-500/10 text-${stat.color}-600 dark:text-${stat.color}-400`}>
                        <stat.icon className="h-5 w-5" />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                      <h3 className="text-2xl font-bold tracking-tight mt-1">{stat.value}</h3>
                      <p className="text-xs font-medium text-muted-foreground/70 mt-1 flex items-center gap-1">
                        <Activity className="h-3 w-3" /> {stat.sub}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Daily Performance Chart */}
              <Card className="lg:col-span-2 border-border/50 shadow-sm overflow-hidden bg-gradient-to-b from-background to-secondary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                  <div>
                    <CardTitle className="text-lg font-bold">Growth Velocity</CardTitle>
                    <p className="text-sm text-muted-foreground">Volume vs. Fulfillment efficiency</p>
                  </div>
                  <Target className="h-5 w-5 text-muted-foreground/50" />
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-100%">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                          tickFormatter={d => d.split('-').slice(1).join('/')}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="orders" 
                          stroke="#6366f1" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorOrders)" 
                          name="Total Orders"
                          animationDuration={1500}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="delivered" 
                          stroke="#10b981" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorDelivered)" 
                          name="Successful"
                          animationDuration={2000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* City Distribution */}
              <Card className="border-border/50 shadow-sm bg-gradient-to-b from-background to-secondary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                  <div>
                    <CardTitle className="text-lg font-bold">Market Density</CardTitle>
                    <p className="text-sm text-muted-foreground">Top performing regions</p>
                  </div>
                  <MapPin className="h-5 w-5 text-muted-foreground/50" />
                </CardHeader>
                <CardContent>
                  {data.cityPerformance.length > 0 ? (
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.cityPerformance} layout="vertical" margin={{ left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                          <XAxis type="number" hide />
                          <YAxis 
                            type="category" 
                            dataKey="city" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fontWeight: 500 }}
                            width={80} 
                          />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                          <Bar 
                            dataKey="orders" 
                            fill="#6366f1" 
                            radius={[0, 6, 6, 0]} 
                            barSize={24}
                            animationDuration={1500}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-border rounded-xl">
                      <MapPin className="h-8 w-8 text-muted-foreground/20 mb-2" />
                      <p className="text-sm text-muted-foreground">No geographic data tracked for this period.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="py-24 text-center">
            <div className="inline-flex p-4 rounded-full bg-secondary mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold">No Data Points Found</h3>
            <p className="text-muted-foreground max-w-xs mx-auto mt-2">
              We couldn't find any order history for the selected timeframe. Try refreshing or check back later.
            </p>
            <Button variant="outline" className="mt-6 rounded-xl" onClick={fetchData}>
              Check Again
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
