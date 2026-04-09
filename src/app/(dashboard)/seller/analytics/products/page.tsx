'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useUser } from '@/hooks/use-user'
import { RefreshCcw, Loader2, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'

interface ProductStats {
  productId: string
  productName: string
  productSku: string
  leads: number
  confirmed: number
  cancelled: number
  returned: number
  delivered: number
  shipped: number
  confirmationRate: number
  deliveryRate: number
}

export default function SellerProductsAnalyticsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [data, setData] = useState<ProductStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userLoading && (!user || user.role !== 'SELLER')) {
      router.push('/unauthorized')
    }
  }, [user, userLoading, router])

  const fetchData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch('/api/analytics/products?sellerId=' + user.id)
      if (res.ok) {
        const json = await res.json()
        setData(json.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch products analytics:', error)
      toast.error('Failed to load products analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-GA', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(value)

  const formatRate = (value: number) => `${value.toFixed(1)}%`

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user || user.role !== 'SELLER') return null

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />Products Analytics
            </h1>
            <p className="text-muted-foreground text-sm">Your products performance metrics</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Products Table */}
        <Card>
          <CardContent className="p-6">
            {data.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <p>No products found</p>
                <p className="text-sm mt-2">Add products to start tracking analytics</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-medium">Product</th>
                      <th className="text-left p-4 font-medium">SKU</th>
                      <th className="text-center p-4 font-medium">Leads</th>
                      <th className="text-center p-4 font-medium">Confirmed</th>
                      <th className="text-center p-4 font-medium">Cancelled</th>
                      <th className="text-center p-4 font-medium">Returned</th>
                      <th className="text-center p-4 font-medium">Delivered</th>
                      <th className="text-center p-4 font-medium">Shipped</th>
                      <th className="text-center p-4 font-medium">Conf. Rate</th>
                      <th className="text-center p-4 font-medium">Del. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((item, index) => (
                      <tr
                        key={item.productId}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">{item.productSku}</p>
                          </div>
                        </td>
                        <td className="p-4 text-center">{item.leads}</td>
                        <td className="p-4 text-center text-green-600 font-medium">{item.confirmed}</td>
                        <td className="p-4 text-center text-red-600 font-medium">{item.cancelled}</td>
                        <td className="p-4 text-center text-orange-600 font-medium">{item.returned}</td>
                        <td className="p-4 text-center text-blue-600 font-medium">{item.delivered}</td>
                        <td className="p-4 text-center text-purple-600 font-medium">{item.shipped}</td>
                        <td className="p-4 text-center">
                          <span className={item.confirmationRate >= 30 ? 'text-green-600' : item.confirmationRate >= 15 ? 'text-yellow-600' : 'text-red-600'}>
                            {formatRate(item.confirmationRate)}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={item.deliveryRate >= 80 ? 'text-green-600' : item.deliveryRate >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                            {formatRate(item.deliveryRate)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="text-sm text-muted-foreground">
          <p>Legend: <span className="inline-block w-3 h-3 rounded bg-green-100 mr-1"></span> ≥30% Excellent <span className="inline-block w-3 h-3 rounded bg-yellow-100 mr-1"></span> 15-29% Good <span className="inline-block w-3 h-3 rounded bg-red-100 mx-1"></span> &lt;15% Poor</p>
          <p className="mt-2">Delivery Rate: <span className="inline-block w-3 h-3 rounded bg-green-100 mr-1"></span> ≥80% Excellent <span className="inline-block w-3 h-3 rounded bg-yellow-100 mr-1"></span> 50-79% Good <span className="inline-block w-3 h-3 rounded bg-red-100 mx-1"></span> &lt;50% Poor</p>
        </div>
      </div>
    </>
  )
}
