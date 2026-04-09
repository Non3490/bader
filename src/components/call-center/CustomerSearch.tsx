'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  Loader2,
  Phone,
  Package,
  Clock,
  RotateCcw,
  X,
} from 'lucide-react'

interface Customer {
  id: string
  phone: string
  deliveryRate: number
  orderCount: number
  deliveredCount: number
  recentOrders?: Array<{
    id: string
    trackingNumber: string
    recipientName: string
    codAmount: number
    status: string
    source: string
    createdAt: string
    city: string
    address: string
    itemNames: string
  }>
}

interface CustomerSearchProps {
  onSelectCustomer?: (customer: Customer) => void
  onRepeatOrder?: (orderId: string) => void
  className?: string
  autoFocus?: boolean
}

const statusConfig: Record<string, { label: string; color: string }> = {
  NEW: { label: 'New', color: 'bg-blue-100 text-blue-700' },
  CONFIRMED: { label: 'Confirmed', color: 'bg-green-100 text-green-700' },
  SHIPPED: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-700' },
  DELIVERED: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-700' },
  RETURNED: { label: 'Returned', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700' },
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('fr-GA', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

export function CustomerSearch({
  onSelectCustomer,
  onRepeatOrder,
  className,
  autoFocus = false
}: CustomerSearchProps) {
  const [searchPhone, setSearchPhone] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searching, setSearching] = useState(false)
  const [showRecentOrders, setShowRecentOrders] = useState(false)

  const searchCustomer = useCallback(async (phone: string) => {
    if (phone.length < 3) {
      setSearchResults([])
      setSelectedCustomer(null)
      return
    }

    setSearching(true)
    try {
      const res = await fetch(`/api/phone-orders/customer-search?phone=${encodeURIComponent(phone)}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.customers || [])

        // Auto-select first result if available
        if (data.customers && data.customers.length > 0) {
          const customer = data.customers[0]
          setSelectedCustomer(customer)
          setShowRecentOrders(true)
          onSelectCustomer?.(customer)
        } else {
          setSelectedCustomer(null)
          setShowRecentOrders(false)
        }
      }
    } catch (error) {
      console.error('Customer search error:', error)
    } finally {
      setSearching(false)
    }
  }, [onSelectCustomer])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchPhone) {
        searchCustomer(searchPhone)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchPhone, searchCustomer])

  const handleRepeatOrder = (orderId: string) => {
    onRepeatOrder?.(orderId)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search Input */}
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by phone number..."
          value={searchPhone}
          onChange={(e) => setSearchPhone(e.target.value)}
          className="pl-10 pr-10"
          autoFocus={autoFocus}
        />
        {searchPhone && (
          <button
            onClick={() => {
              setSearchPhone('')
              setSearchResults([])
              setSelectedCustomer(null)
              setShowRecentOrders(false)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
        {searching && (
          <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Selected Customer Info */}
      {selectedCustomer && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-900">{selectedCustomer.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <Badge variant="secondary" className="bg-green-200 text-green-800">
                    {selectedCustomer.orderCount} orders
                  </Badge>
                  <span>•</span>
                  <span>{selectedCustomer.deliveredCount} delivered</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRecentOrders(!showRecentOrders)}
              >
                {showRecentOrders ? 'Hide' : 'Show'} Orders
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Customer Found */}
      {searchPhone.length >= 3 && !searching && searchResults.length === 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-800">
              No existing customer found for phone <strong>{searchPhone}</strong>.
              A new customer will be created when you place the order.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent Orders */}
      {selectedCustomer && showRecentOrders && selectedCustomer.recentOrders && selectedCustomer.recentOrders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Recent Orders ({selectedCustomer.recentOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3 pr-4">
                {selectedCustomer.recentOrders.map(order => {
                  const statusInfo = statusConfig[order.status] || statusConfig.NEW
                  return (
                    <div
                      key={order.id}
                      className="p-3 border rounded-lg space-y-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{order.trackingNumber}</span>
                            <Badge variant="secondary" className={cn('text-xs', statusInfo.color)}>
                              {statusInfo.label}
                            </Badge>
                            {order.source === 'PHONE' && (
                              <Badge variant="outline" className="text-xs">
                                Phone
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{order.itemNames}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatDate(order.createdAt)}</span>
                            <span>•</span>
                            <span>{order.city}</span>
                          </div>
                          <p className="text-sm font-medium">{formatMoney(order.codAmount)}</p>
                        </div>
                        {onRepeatOrder && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRepeatOrder(order.id)}
                            className="shrink-0"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Repeat
                          </Button>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        📍 {order.address}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Customer Notes Section - could be enhanced to show persistent notes */}
      {selectedCustomer && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Customer Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Add notes about this customer (preferences, delivery instructions, etc.)
            </p>
            {/* Note input could be added here for future enhancement */}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
