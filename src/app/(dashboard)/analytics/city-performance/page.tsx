'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  TrendingUp,
  MapPin,
  RefreshCcw,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Target,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CityPerformanceData {
  city: string
  leads: number
  confirmed: number
  delivered: number
  returned: number
  deliveryRate: number
  confirmationRate: number
  totalRevenue: number
  avgOrderValue: number
}

export default function CityPerformancePage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [data, setData] = useState<CityPerformanceData[]>([])
  const [period, setPeriod] = useState('7d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userLoading && !user) router.push('/login')
  }, [user, userLoading, router])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics/city-performance?period=${period}`)
      if (res.ok) {
        const result = await res.json()
        setData(result.cityPerformance || [])
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to load city performance data')
      }
    } catch (error) {
      toast.error('Failed to load city performance data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'SELLER')) {
      fetchData()
    }
  }, [user, period])

  const fmt = (v: number) =>
    new Intl.NumberFormat('fr-GA', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(v)

  if (userLoading || !user) return null

  const totalLeads = data.reduce((sum, c) => sum + c.leads, 0)
  const totalConfirmed = data.reduce((sum, c) => sum + c.confirmed, 0)
  const totalDelivered = data.reduce((sum, c) => sum + c.delivered, 0)
  const totalReturned = data.reduce((sum, c) => sum + c.returned, 0)
  const totalRevenue = data.reduce((sum, c) => sum + c.totalRevenue, 0)

  const overallDeliveryRate = totalLeads > 0 ? parseFloat(((totalDelivered / totalLeads) * 100).toFixed(1)) : 0
  const overallConfirmationRate = totalLeads > 0 ? parseFloat(((totalConfirmed / totalLeads) * 100).toFixed(1)) : 0
  const overallReturnRate = totalDelivered > 0 ? parseFloat(((totalReturned / totalDelivered) * 100).toFixed(1)) : 0
  const avgOrderValue = totalDelivered > 0 ? Math.round(totalRevenue / totalDelivered) : 0

  // Get insight message based on data
  const getInsight = () => {
    if (data.length === 0) return 'No data available'

    const bestCity = data.reduce((best, c) => c.deliveryRate > best.deliveryRate ? c : best, data[0])
    const worstCity = data.reduce((worst, c) => c.deliveryRate < worst.deliveryRate ? c : worst, data[0])

    if (bestCity.city === worstCity.city) {
      return 'All cities performing similarly'
    }

    const bestGap = bestCity.deliveryRate - worstCity.deliveryRate
    if (bestGap > 20) {
      return `${bestCity.city} leads at ${bestCity.deliveryRate}% delivery rate, significantly ahead of ${worstCity.city} (${worstCity.deliveryRate}%)`
    }

    return `Focus ads on ${bestCity.city} for best results. ${worstCity.city} (${worstCity.deliveryRate}%) may need improved logistics.`
  }

  // Sort by delivery rate for recommendations
  const sortedByDeliveryRate = [...data].sort((a, b) => b.deliveryRate - a.deliveryRate)
  const recommendedCities = sortedByDeliveryRate.slice(0, 3)
  const underperformingCities = data.filter(c => c.deliveryRate < 50)

  return (
    <>
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
                <MapPin className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">City Performance</h1>
            </div>
            <p className="text-muted-foreground">
              Comprehensive delivery analytics by city for informed marketing decisions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCcw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
            <h3 className="text-xl font-semibold">No City Data Available</h3>
            <p className="text-muted-foreground">Orders will appear here once customers start placing orders in different cities.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Key Metrics Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Total Leads</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-indigo-600">{totalLeads}</div>
                  <p className="text-sm text-muted-foreground">~{parseFloat((totalLeads / 7).toFixed(1))}/day</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Confirmed Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{totalConfirmed}</div>
                  <p className="text-sm text-muted-foreground">{overallConfirmationRate}% rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Delivered Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{totalDelivered}</div>
                  <p className="text-sm text-muted-foreground">{overallDeliveryRate}% rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Returned Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">{totalReturned}</div>
                  <p className="text-sm text-muted-foreground">{overallReturnRate}% of delivered</p>
                </CardContent>
              </Card>
            </div>

            {/* Insight Banner */}
            <Card className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-indigo-500/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-indigo-900 dark:text-indigo-100">Key Insight</p>
                    <p className="text-sm text-indigo-700 dark:text-indigo-300">{getInsight()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Main Performance Table - exactly as in scenario */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">City Performance Table</CardTitle>
                <CardDescription>
                  {period === '7d' ? 'Last 7 days' : `Last ${period === '30d' ? '30' : '90'} days`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/30">
                        <TableHead className="pl-6">City</TableHead>
                        <TableHead className="text-center">Leads</TableHead>
                        <TableHead className="text-center">Confirmed</TableHead>
                        <TableHead className="text-center">Delivered</TableHead>
                        <TableHead className="text-center">Returned</TableHead>
                        <TableHead className="text-center bg-muted-50/50">Delivery Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((city, index) => {
                        const isTopPerformer = index === 0 && city.deliveryRate === Math.max(...data.map(c => c.deliveryRate))
                        const isUnderperforming = city.deliveryRate < 50

                        return (
                          <TableRow key={city.city} className={cn(
                            'hover:bg-muted/20 transition-colors',
                            isTopPerformer && 'bg-green-500/5',
                            isUnderperforming && 'bg-red-500/5'
                          )}>
                            <TableCell className="pl-6">
                              <div className="flex items-center gap-2">
                                {isTopPerformer && (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                )}
                                {isUnderperforming && (
                                  <AlertTriangle className="h-4 w-4 text-red-600" />
                                )}
                                <span className="font-medium">{city.city}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold">{city.leads}</TableCell>
                            <TableCell className="text-center">{city.confirmed}</TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-blue-600">{city.delivered}</span>
                            </TableCell>
                            <TableCell className="text-center">{city.returned}</TableCell>
                            <TableCell className="text-center bg-muted-50/50">
                              <div className="flex items-center justify-center gap-2">
                                <Badge
                                  className={cn(
                                    'px-3 py-1 rounded-full text-sm font-bold',
                                    city.deliveryRate >= 60
                                      ? 'bg-green-500 text-white'
                                      : city.deliveryRate >= 50
                                      ? 'bg-yellow-500 text-white'
                                      : 'bg-red-500 text-white'
                                  )}
                                >
                                  {city.deliveryRate}%
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5" />
                  Market Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <p className="font-semibold">Top Performing Cities (Focus Ads Here)</p>
                  <div className="space-y-2">
                    {recommendedCities.map((city, idx) => (
                      <div key={city.city} className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                        <Badge variant="outline" className="text-green-600 border-green-500">
                          {idx + 1}
                        </Badge>
                        <div>
                          <p className="font-medium text-foreground">{city.city}</p>
                          <p className="text-sm text-muted-foreground">
                            {city.deliveryRate}% delivery rate • {fmt(city.totalRevenue)} revenue
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {underperformingCities.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-border/50">
                    <p className="font-semibold text-red-600">Cities Needing Attention</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      These cities have delivery rates below 50%. Consider logistics improvements or pausing ads.
                    </p>
                    <div className="grid gap-2">
                      {underperformingCities.map((city) => (
                        <div key={city.city} className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                          <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-foreground">{city.city}</p>
                            <p className="text-sm text-red-600 font-semibold">
                              {city.deliveryRate}% delivery rate
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
