'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUser } from '@/hooks/use-user'
import {
  ArrowLeft,
  Package,
  User,
  Phone,
  MapPin,
  DollarSign,
  Calendar,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
  RefreshCcw,
  Edit,
  History,
  MessageSquare,
  Send,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface OrderDetail {
  id: string
  trackingNumber: string
  customerName: string
  customerPhone: string
  customerAddress: string
  city: string
  productSku: string | null
  productName: string
  quantity: number
  codAmount: number
  productCost: number
  shippingCost: number
  callCenterFee: number
  adSpend: number
  status: string
  notes: string | null
  createdAt: string
  confirmedAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  returnedAt: string | null
  cancelledAt: string | null
  user: {
    id: string
    name: string
    email: string
    role: string
  } | null
  history: Array<{
    id: string
    oldStatus: string | null
    newStatus: string
    notes: string | null
    changedBy: string
    createdAt: string
  }>
  callLogs: Array<{
    id: string
    status: string
    notes: string | null
    duration: number | null
    user: { id: string; name: string }
    createdAt: string
  }>
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  NEW: { label: 'New', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: <Clock className="h-4 w-4" /> },
  CONFIRMED: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: <CheckCircle className="h-4 w-4" /> },
  SHIPPED: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200', icon: <Truck className="h-4 w-4" /> },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: <CheckCircle className="h-4 w-4" /> },
  RETURNED: { label: 'Returned', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: <XCircle className="h-4 w-4" /> },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200', icon: <XCircle className="h-4 w-4" /> }
}

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const { user, loading: userLoading } = useUser()
  
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [dispatching, setDispatching] = useState(false)
  const [carriers, setCarriers] = useState<Array<{ id: string; name: string; isActive: boolean }>>([])

  useEffect(() => {
    // Fetch available carriers for dispatch
    fetch('/api/settings/carriers')
      .then(res => res.json())
      .then(data => setCarriers(data.data || []))
      .catch(() => setCarriers([]))
  }, [])

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    }
  }, [user, userLoading, router])

  useEffect(() => {
    if (user && orderId) {
      fetchOrder()
    }
  }, [user, orderId])

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`)
      if (response.ok) {
        const data = await response.json()
        setOrder(data.order)
      } else {
        toast.error('Order not found')
        router.push('/orders')
      }
    } catch (error) {
      toast.error('Failed to load order. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GA', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const calculateProfit = () => {
    if (!order) return 0
    return order.codAmount - (order.productCost + order.shippingCost + order.callCenterFee + order.adSpend)
  }

  const handleDispatchToCarrier = async (carrierName: string) => {
    if (!confirm(`Dispatch order ${order.trackingNumber} to ${carrierName.toUpperCase()}?`)) return

    setDispatching(true)
    try {
      const response = await fetch(`/api/carriers/dispatch/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrierName })
      })

      if (response.ok) {
        toast.success('Order dispatched to carrier')
        fetchOrder()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to dispatch to carrier')
      }
    } catch (error) {
      toast.error('Failed to dispatch to carrier')
    } finally {
      setDispatching(false)
    }
  }

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user || !order) return null

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{order.trackingNumber}</h1>
              <Badge className={statusConfig[order.status]?.color}>
                {statusConfig[order.status]?.icon}
                <span className="ml-1">{statusConfig[order.status]?.label}</span>
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Created on {formatDate(order.createdAt)}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{order.customerName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{order.customerPhone}</p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(`tel:${order.customerPhone}`, '_self')}
                      >
                        <Phone className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Address</p>
                  <p className="font-medium">{order.customerAddress}</p>
                  <p className="text-sm text-muted-foreground">{order.city}</p>
                </div>
              </CardContent>
            </Card>

            {/* Product Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Product Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Product</p>
                    <p className="font-medium">{order.productName}</p>
                    {order.productSku && (
                      <p className="text-xs text-muted-foreground">SKU: {order.productSku}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Quantity</p>
                    <p className="font-medium">{order.quantity}</p>
                  </div>
                </div>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">COD Amount</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(order.codAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Net Profit</p>
                    <p className={cn(
                      "text-xl font-bold",
                      calculateProfit() >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {formatCurrency(calculateProfit())}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cost Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Cost Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Product Cost</span>
                    <span className="font-medium">{formatCurrency(order.productCost)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Shipping Cost</span>
                    <span className="font-medium">{formatCurrency(order.shippingCost)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Call Center Fee</span>
                    <span className="font-medium">{formatCurrency(order.callCenterFee)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Ad Spend</span>
                    <span className="font-medium">{formatCurrency(order.adSpend)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Costs</span>
                    <span className="font-bold text-red-600">
                      {formatCurrency(order.productCost + order.shippingCost + order.callCenterFee + order.adSpend)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Call Logs */}
            {order.callLogs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Call History ({order.callLogs.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {order.callLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{log.status}</Badge>
                            <span className="text-xs text-muted-foreground">
                              by {log.user.name}
                            </span>
                          </div>
                          {log.notes && (
                            <p className="text-sm mt-1">{log.notes}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(log.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Status Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.history.map((entry, index) => (
                    <div key={entry.id} className="relative pl-6 pb-4 last:pb-0">
                      {index !== order.history.length - 1 && (
                        <div className="absolute left-2 top-3 bottom-0 w-px bg-border" />
                      )}
                      <div className="absolute left-0 top-1 h-4 w-4 rounded-full bg-primary" />
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusConfig[entry.newStatus]?.color}>
                            {statusConfig[entry.newStatus]?.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {entry.notes || `Status changed from ${entry.oldStatus || 'New'}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          by {entry.changedBy} • {formatDate(entry.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Assigned User */}
            {order.user && (
              <Card>
                <CardHeader>
                  <CardTitle>Assigned To</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{order.user.name}</p>
                      <p className="text-sm text-muted-foreground">{order.user.email}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {order.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{order.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push(`/orders?edit=${orderId}`)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Order
                  </Button>
                  {order.status === 'CONFIRMED' && carriers.length > 0 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-start" disabled={dispatching}>
                          {dispatching ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Dispatching...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send to Carrier
                            </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => handleDispatchToCarrier('shipsen')}
                          disabled={!carriers.find(c => c.name === 'shipsen' && c.isActive)}
                        >
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-yellow-600" />
                            <span>Shipsen</span>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDispatchToCarrier('colisswift')}
                          disabled={!carriers.find(c => c.name === 'colisswift' && c.isActive)}
                        >
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-orange-600" />
                            <span>ColisSwift</span>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDispatchToCarrier('afriquecod')}
                          disabled={!carriers.find(c => c.name === 'afriquecod' && c.isActive)}
                        >
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-purple-600" />
                            <span>AfriqueCOD</span>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      disabled={order.status !== 'CONFIRMED' || carriers.length === 0}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {carriers.length === 0 ? 'No Carriers' : 'Order must be CONFIRMED'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
