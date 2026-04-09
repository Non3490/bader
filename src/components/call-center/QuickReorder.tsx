'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Package,
  RotateCcw,
  Loader2,
  X,
  MapPin,
  CreditCard,
  User,
} from 'lucide-react'

interface LastOrder {
  id: string
  trackingNumber: string
  recipientName: string
  phone: string
  address: string
  city: string
  codAmount: number
  items: Array<{
    productId: string
    productName: string
    quantity: number
    unitPrice: number
  }>
  orderDate: string
}

interface QuickReorderProps {
  customerId?: string
  customerPhone?: string
  onReorder?: (order: LastOrder) => void
  onClose?: () => void
  className?: string
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

export function QuickReorder({
  customerId,
  customerPhone,
  onReorder,
  onClose,
  className
}: QuickReorderProps) {
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null)
  const [loading, setLoading] = useState(false)
  const [found, setFound] = useState<boolean | null>(null)

  const fetchLastOrder = useCallback(async () => {
    if (!customerId && !customerPhone) return

    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (customerId) params.append('customerId', customerId)
      if (customerPhone) params.append('phone', customerPhone)

      const res = await fetch(`/api/phone-orders/repeat?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.found && data.order) {
          setLastOrder(data.order)
          setFound(true)
        } else {
          setFound(false)
          setLastOrder(null)
        }
      }
    } catch (error) {
      console.error('Failed to fetch last order:', error)
    } finally {
      setLoading(false)
    }
  }, [customerId, customerPhone])

  useEffect(() => {
    fetchLastOrder()
  }, [fetchLastOrder])

  const handleRepeatOrder = () => {
    if (lastOrder) {
      onReorder?.(lastOrder)
      toast.success('Order items loaded! Complete the order details.')
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (found === false) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Quick Reorder
            </CardTitle>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No previous orders found for this customer
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!lastOrder) return null

  return (
    <Card className={cn('border-green-200 bg-green-50/30', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-green-600" />
            Quick Reorder Available
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-4 pr-4">
            {/* Order Info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Last Order</span>
                <Badge variant="outline" className="text-xs">
                  {lastOrder.trackingNumber}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(lastOrder.orderDate)}
              </p>
            </div>

            {/* Customer Info */}
            <div className="space-y-2 p-3 bg-white/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{lastOrder.recipientName}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{lastOrder.address}, {lastOrder.city}</span>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <p className="text-xs font-medium">Items to Reorder:</p>
              <div className="space-y-1">
                {lastOrder.items.map((item, index) => (
                  <div
                    key={`${item.productId}-${index}`}
                    className="flex items-center justify-between text-xs p-2 bg-white/50 rounded"
                  >
                    <span className="flex-1">
                      {item.productName} x{item.quantity}
                    </span>
                    <span className="text-muted-foreground">
                      {formatMoney(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between p-3 bg-green-100/50 rounded-lg">
              <span className="text-sm font-medium">Total</span>
              <span className="text-lg font-bold text-green-700">
                {formatMoney(lastOrder.codAmount)}
              </span>
            </div>

            {/* Repeat Button */}
            <Button
              onClick={handleRepeatOrder}
              className="w-full"
              size="sm"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Repeat This Order
            </Button>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
