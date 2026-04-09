'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Check,
  Loader2,
  Package,
  Phone,
  Plus,
  Search,
  Trash2,
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
    createdAt: string
  }>
}

interface Product {
  id: string
  name: string
  sku: string
  sellPrice: number
  isActive: boolean
}

interface OrderItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

type OrderType = 'DELIVERY' | 'PICKUP'
type PaymentMethod = 'CASH' | 'CARD' | 'ONLINE'

function formatMoney(value: number) {
  return new Intl.NumberFormat('fr-GA', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(value)
}

export default function PhoneOrderPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [searchPhone, setSearchPhone] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([])
  const [searching, setSearching] = useState(false)

  // Order form state
  const [recipientName, setRecipientName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('Libreville')
  const [orderType, setOrderType] = useState<OrderType>('DELIVERY')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [notes, setNotes] = useState('')
  const [discountCode, setDiscountCode] = useState('')

  // Products and items
  const [products, setProducts] = useState<Product[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [itemQuantity, setItemQuantity] = useState(1)
  const [loadingProducts, setLoadingProducts] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  // Fetch products for item selection
  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true)
      try {
        const res = await fetch('/api/products')
        if (res.ok) {
          const data = await res.json()
          setProducts(data.products || [])
        }
      } catch (error) {
        console.error('Failed to fetch products:', error)
      } finally {
        setLoadingProducts(false)
      }
    }
    fetchProducts()
  }, [])

  // Customer search
  const searchCustomer = useCallback(async (phone: string) => {
    if (phone.length < 3) {
      setCustomerSearchResults([])
      return
    }

    setSearching(true)
    try {
      const res = await fetch(`/api/phone-orders/customer-search?phone=${encodeURIComponent(phone)}`)
      if (res.ok) {
        const data = await res.json()
        setCustomerSearchResults(data.customers || [])
        if (data.customers && data.customers.length > 0) {
          // Auto-select first result
          const customer = data.customers[0]
          setSelectedCustomer(customer)
          setRecipientName(customer.recentOrders?.[0]?.recipientName || '')
          setAddress(customer.recentOrders?.[0]?.address || '')
          setCity(customer.recentOrders?.[0]?.city || 'Libreville')
        }
      }
    } catch (error) {
      console.error('Customer search error:', error)
    } finally {
      setSearching(false)
    }
  }, [])

  // Add item to order
  const addItem = () => {
    if (!selectedProductId) return

    const product = products.find(p => p.id === selectedProductId)
    if (!product) return

    // Check if item already exists
    const existingItem = orderItems.find(i => i.productId === selectedProductId)
    if (existingItem) {
      setOrderItems(orderItems.map(i =>
        i.productId === selectedProductId
          ? { ...i, quantity: i.quantity + itemQuantity }
          : i
      ))
    } else {
      setOrderItems([...orderItems, {
        productId: product.id,
        productName: product.name,
        quantity: itemQuantity,
        unitPrice: product.sellPrice
      }])
    }

    setSelectedProductId('')
    setItemQuantity(1)
  }

  // Remove item from order
  const removeItem = (productId: string) => {
    setOrderItems(orderItems.filter(i => i.productId !== productId))
  }

  // Calculate total
  const totalAmount = orderItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)

  // Submit order
  const submitOrder = async () => {
    if (!selectedCustomer || !searchPhone) {
      toast.error('Please search and select a customer first')
      return
    }

    if (orderItems.length === 0) {
      toast.error('Please add at least one item to the order')
      return
    }

    if (!recipientName || !address || !city) {
      toast.error('Please fill in all customer details')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/phone-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          customerPhone: searchPhone,
          recipientName,
          address,
          city,
          items: orderItems,
          orderType,
          paymentMethod,
          discountCode: discountCode || undefined,
          notes: notes || undefined,
          codAmount: totalAmount
        })
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`Order created successfully! Tracking: ${data.order.trackingNumber}`)

        // Reset form
        setSearchPhone('')
        setSelectedCustomer(null)
        setCustomerSearchResults([])
        setRecipientName('')
        setAddress('')
        setCity('Libreville')
        setOrderItems([])
        setNotes('')
        setDiscountCode('')
        setOrderType('DELIVERY')
        setPaymentMethod('CASH')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to create order')
      }
    } catch (error) {
      console.error('Submit order error:', error)
      toast.error('Failed to create order')
    } finally {
      setSubmitting(false)
    }
  }

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'SELLER')) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">You don't have access to this page.</p>
          <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Phone Orders</h1>
              <p className="text-sm text-muted-foreground">
                Create new orders from customer phone calls
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Customer Search and Details */}
          <div className="space-y-6">
            {/* Customer Search */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Customer Search
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Input
                    placeholder="Enter phone number..."
                    value={searchPhone}
                    onChange={(e) => {
                      setSearchPhone(e.target.value)
                      if (e.target.value.length >= 3) {
                        searchCustomer(e.target.value)
                      } else {
                        setCustomerSearchResults([])
                        setSelectedCustomer(null)
                      }
                    }}
                    className="pr-10"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {selectedCustomer && (
                  <div className="space-y-2 p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Customer Found</span>
                      <Badge variant="secondary">
                        {selectedCustomer.orderCount} orders
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Delivery Rate: {selectedCustomer.deliveredCount}/{selectedCustomer.orderCount}
                    </p>
                  </div>
                )}

                {!selectedCustomer && searchPhone.length >= 3 && !searching && customerSearchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No customer found. A new customer will be created.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Customer Details */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recipientName">Recipient Name *</Label>
                  <Input
                    id="recipientName"
                    placeholder="Customer full name"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address *</Label>
                  <Textarea
                    id="address"
                    placeholder="Delivery address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Select value={city} onValueChange={setCity}>
                    <SelectTrigger id="city">
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Libreville">Libreville</SelectItem>
                      <SelectItem value="Port-Gentil">Port-Gentil</SelectItem>
                      <SelectItem value="Franceville">Franceville</SelectItem>
                      <SelectItem value="Oyem">Oyem</SelectItem>
                      <SelectItem value="Mouila">Mouila</SelectItem>
                      <SelectItem value="Lambaréné">Lambaréné</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Item Form */}
              <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="product">Product</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger id="product">
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products
                        .filter(p => p.isActive)
                        .map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - {formatMoney(product.sellPrice)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>

                <Button
                  onClick={addItem}
                  disabled={!selectedProductId}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {/* Order Items List */}
              {orderItems.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Items ({orderItems.length})</span>
                    <span>Total: {formatMoney(totalAmount)}</span>
                  </div>
                  <div className="space-y-2">
                    {orderItems.map(item => (
                      <div
                        key={item.productId}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} x {formatMoney(item.unitPrice)} = {formatMoney(item.quantity * item.unitPrice)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.productId)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No items added yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Right Column - Order Settings */}
          <div className="space-y-6">
            {/* Order Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Order Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orderType">Order Type</Label>
                  <Select value={orderType} onValueChange={(v: OrderType) => setOrderType(v)}>
                    <SelectTrigger id="orderType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DELIVERY">Delivery</SelectItem>
                      <SelectItem value="PICKUP">Pickup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={(v: PaymentMethod) => setPaymentMethod(v)}>
                    <SelectTrigger id="paymentMethod">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash on Delivery</SelectItem>
                      <SelectItem value="CARD">Card</SelectItem>
                      <SelectItem value="ONLINE">Online Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discountCode">Discount Code (Optional)</Label>
                  <Input
                    id="discountCode"
                    placeholder="Enter discount code"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Order Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Special instructions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {notes.length}/500
                  </p>
                </div>

                {orderItems.length > 0 && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Order Total</span>
                      <span className="text-lg font-bold">{formatMoney(totalAmount)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      COD amount to collect
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              onClick={submitOrder}
              disabled={submitting || !selectedCustomer || orderItems.length === 0}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Order...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Create Phone Order
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
