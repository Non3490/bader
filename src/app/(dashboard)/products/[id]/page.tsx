'use client'

import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUser } from '@/hooks/use-user'
import {
  Package,
  DollarSign,
  ShoppingCart,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Warehouse,
  Store,
  ArrowUpRight,
  ArrowDownRight,
  Phone,
  Image as ImageIcon,
  RefreshCcw,
  Edit,
  ArrowRightLeft,
  History,
  Calendar,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  sku: string
  name: string
  shortDescription: string | null
  longDescription: string | null
  imageUrl: string | null
  supplierName: string | null
  supplierPhone: string | null
  cargoName: string | null
  cargoPhone: string | null
  quantityPricing: string | null
  category: string | null
  costPrice: number | null
  sellPrice: number
  isActive: boolean
  authorizeOpen: boolean
  seller: {
    id: string
    name: string
  }
  stocks: Array<{
    id: string
    warehouse: { id: string; name: string; city: string } | null
    quantity: number
    alertLevel: number
    movements: Array<{
      id: string
      type: string
      quantity: number
      reason: string
      createdAt: string
      user?: { name: string }
    }>
  }>
  stockSnapshots: Array<{
    id: string
    date: string
    initialStock: number
    finalStock: number
    inForDelivery: number
    outForDelivery: number
  }>
}

interface Warehouse {
  id: string
  name: string
  city: string
}

interface QuantityPricingTier {
  min: number
  max: number
  price: number
}

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [product, setProduct] = useState<Product | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Stock movement dialog state
  const [movementDialogOpen, setMovementDialogOpen] = useState(false)
  const [selectedStockId, setSelectedStockId] = useState<string>('')
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('IN')
  const [movementQuantity, setMovementQuantity] = useState('')
  const [movementReason, setMovementReason] = useState('')
  const [submittingMovement, setSubmittingMovement] = useState(false)

  // Stock transfer dialog state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [transferFromWarehouse, setTransferFromWarehouse] = useState<string>('')
  const [transferToWarehouse, setTransferToWarehouse] = useState<string>('')
  const [transferQuantity, setTransferQuantity] = useState('')
  const [submittingTransfer, setSubmittingTransfer] = useState(false)

  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all')

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/products/${params.id}`)
        if (!res.ok) {
          if (res.status === 404) {
            notFound()
          }
          throw new Error('Failed to fetch product')
        }
        const data = await res.json()
        setProduct(data.product)
        if (data.product.stocks.length > 0) {
          setSelectedStockId(data.product.stocks[0].id)
        }
      } catch (error) {
        console.error('Failed to fetch product:', error)
      } finally {
        setLoading(false)
      }
    }

    async function fetchWarehouses() {
      try {
        const res = await fetch('/api/warehouses')
        if (res.ok) {
          const data = await res.json()
          setWarehouses(data.warehouses || [])
        }
      } catch (error) {
        console.error('Failed to fetch warehouses:', error)
      }
    }

    if (!userLoading && user) {
      fetchProduct()
      fetchWarehouses()
    }
  }, [params.id, user, userLoading])

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    }
  }, [user, userLoading, router])

  const fetchData = async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/products/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setProduct(data.product)
      }
    } catch (error) {
      console.error('Failed to fetch product:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const handleStockMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStockId) return

    setSubmittingMovement(true)
    try {
      const res = await fetch('/api/stock-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockId: selectedStockId,
          type: movementType,
          quantity: parseInt(movementQuantity),
          reason: movementReason,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to record movement')
      }

      toast.success('Stock movement recorded')
      setMovementDialogOpen(false)
      setMovementQuantity('')
      setMovementReason('')
      fetchData()
    } catch (error) {
      console.error('Movement error:', error)
      toast.error('Failed to record movement')
    } finally {
      setSubmittingMovement(false)
    }
  }

  const handleStockTransfer = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!transferFromWarehouse || !transferToWarehouse || transferFromWarehouse === transferToWarehouse) {
      toast.error('Please select different source and destination warehouses')
      return
    }

    setSubmittingTransfer(true)
    try {
      const res = await fetch('/api/stock/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product!.id,
          fromWarehouseId: transferFromWarehouse,
          toWarehouseId: transferToWarehouse,
          quantity: parseInt(transferQuantity),
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to transfer stock')
      }

      toast.success('Stock transferred successfully')
      setTransferDialogOpen(false)
      setTransferQuantity('')
      fetchData()
    } catch (error) {
      console.error('Transfer error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to transfer stock')
    } finally {
      setSubmittingTransfer(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-GA', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(value)

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (userLoading || loading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </>
    )
  }

  if (!user) return null

  // Only ADMIN and SELLER roles can access this page (updated from CALL_CENTER)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'SELLER') {
    return (
      <>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>You don't have permission to view product details.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  if (!product) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Product Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  const totalStock = product.stocks.reduce((sum, stock) => sum + stock.quantity, 0)
  const lowStock = product.stocks.some((s) => s.quantity <= s.alertLevel)

  const quantityPricing: QuantityPricingTier[] = product.quantityPricing
    ? JSON.parse(product.quantityPricing)
    : []

  const filteredStocks =
    selectedWarehouse === 'all'
      ? product.stocks
      : product.stocks.filter((s) => s.warehouse?.id === selectedWarehouse)

  const selectedStock = product.stocks.find((s) => s.id === selectedStockId)

  return (
    <>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Product Details</h1>
            <p className="text-muted-foreground">
              View product information, stock, and history
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={refreshing}>
              <RefreshCcw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
            {(user.role === 'ADMIN' || role === 'SUPER_ADMIN' || user.role === 'SELLER') && (
              <>
                <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      Transfer Stock
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <form onSubmit={handleStockTransfer}>
                      <DialogHeader>
                        <DialogTitle>Transfer Stock</DialogTitle>
                        <DialogDescription>
                          Move stock from one warehouse to another
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="fromWarehouse">From Warehouse</Label>
                          <Select value={transferFromWarehouse} onValueChange={setTransferFromWarehouse} required>
                            <SelectTrigger id="fromWarehouse">
                              <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                            <SelectContent>
                              {product.stocks
                                .filter((s) => s.warehouse)
                                .map((stock) => (
                                  <SelectItem key={stock.warehouse!.id} value={stock.warehouse!.id}>
                                    {stock.warehouse!.name} ({stock.warehouse!.city}) - {stock.quantity} available
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="toWarehouse">To Warehouse</Label>
                          <Select value={transferToWarehouse} onValueChange={setTransferToWarehouse} required>
                            <SelectTrigger id="toWarehouse">
                              <SelectValue placeholder="Select destination" />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouses.map((wh) => (
                                <SelectItem key={wh.id} value={wh.id}>
                                  {wh.name} ({wh.city})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="transferQuantity">Quantity *</Label>
                          <Input
                            id="transferQuantity"
                            type="number"
                            min="1"
                            max={selectedStock?.quantity}
                            value={transferQuantity}
                            onChange={(e) => setTransferQuantity(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setTransferDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={submittingTransfer}>
                          {submittingTransfer ? 'Transferring...' : 'Transfer'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                <Button size="sm" onClick={() => router.push(`/products/${params.id}/edit`)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Product
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Product Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Image & Basic Info */}
            <div className="grid gap-6 md:grid-cols-2">
              {product.imageUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <ImageIcon className="h-4 w-4" />
                      Product Image
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Product Name</p>
                    <p className="font-semibold">{product.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">SKU</p>
                    <p className="font-mono text-sm">{product.sku}</p>
                  </div>
                  {product.category && (
                    <div>
                      <p className="text-xs text-muted-foreground">Category</p>
                      <p className="text-sm">{product.category}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Badge variant={product.isActive ? 'default' : 'secondary'}>
                      {product.isActive ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {product.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    {product.authorizeOpen && (
                      <Badge variant="outline" className="border-orange-200 text-orange-700">
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        Open Orders
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Descriptions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Descriptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {product.shortDescription && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Short Description</p>
                    <p className="text-sm">{product.shortDescription}</p>
                  </div>
                )}
                {product.longDescription && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Long Description</p>
                    <p className="text-sm whitespace-pre-wrap">{product.longDescription}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4" />
                  Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Cost Price</p>
                    <p className="text-lg font-semibold">
                      {product.costPrice !== null ? formatCurrency(product.costPrice) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Selling Price</p>
                    <p className="text-lg font-bold text-emerald-600">
                      {formatCurrency(product.sellPrice)}
                    </p>
                  </div>
                </div>

                {quantityPricing.length > 0 && (
                  <div className="space-y-2 pt-4 border-t">
                    <p className="text-xs text-muted-foreground">Quantity-Based Pricing</p>
                    <div className="space-y-2">
                      {quantityPricing.map((tier, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">
                            {tier.min} - {tier.max} units
                          </span>
                          <span className="font-semibold">{formatCurrency(tier.price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Supplier & Cargo Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Warehouse className="h-4 w-4" />
                  Supplier & Cargo Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Supplier Name</p>
                    <p className="text-sm">{product.supplierName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 inline mr-1" />
                      Supplier Phone
                    </p>
                    <p className="text-sm">{product.supplierPhone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cargo Company</p>
                    <p className="text-sm">{product.cargoName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 inline mr-1" />
                      Cargo Phone
                    </p>
                    <p className="text-sm">{product.cargoPhone || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stock Movement History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <History className="h-4 w-4" />
                  Stock Movement History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredStocks.flatMap((s) => s.movements).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No movements recorded for this product
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2 px-2 text-left font-medium">Date</th>
                          <th className="py-2 px-2 text-left font-medium">Type</th>
                          <th className="py-2 px-2 text-right font-medium">Quantity</th>
                          <th className="py-2 px-2 text-left font-medium">Reason</th>
                          <th className="py-2 px-2 text-left font-medium">User</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredStocks
                          .flatMap((s) => s.movements)
                          .slice(0, 20)
                          .map((movement) => (
                            <tr key={movement.id}>
                              <td className="py-2 px-2 text-muted-foreground">
                                {formatDate(movement.createdAt)}
                              </td>
                              <td className="py-2 px-2">
                                <Badge
                                  variant={movement.type.includes('IN') ? 'default' : 'destructive'}
                                  className="text-xs"
                                >
                                  {movement.type.includes('IN') ? (
                                    <ArrowDownRight className="h-3 w-3 mr-1" />
                                  ) : (
                                    <ArrowUpRight className="h-3 w-3 mr-1" />
                                  )}
                                  {movement.type}
                                </Badge>
                              </td>
                              <td className="py-2 px-2 text-right font-medium">
                                {movement.type.includes('IN') ? '+' : '-'}
                                {movement.quantity}
                              </td>
                              <td className="py-2 px-2 text-muted-foreground">
                                {movement.reason}
                              </td>
                              <td className="py-2 px-2 text-muted-foreground">
                                {movement.user?.name || '-'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily Snapshots */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  Daily Stock Snapshots
                </CardTitle>
              </CardHeader>
              <CardContent>
                {product.stockSnapshots.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No snapshots available yet
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2 px-2 text-left font-medium">Date</th>
                          <th className="py-2 px-2 text-right font-medium">Initial</th>
                          <th className="py-2 px-2 text-right font-medium">In</th>
                          <th className="py-2 px-2 text-right font-medium">Out</th>
                          <th className="py-2 px-2 text-right font-medium">Final</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {product.stockSnapshots.slice(0, 10).map((snapshot) => (
                          <tr key={snapshot.id}>
                            <td className="py-2 px-2 text-muted-foreground">
                              {formatDate(snapshot.date)}
                            </td>
                            <td className="py-2 px-2 text-right">{snapshot.initialStock}</td>
                            <td className="py-2 px-2 text-right text-emerald-600">
                              +{snapshot.inForDelivery}
                            </td>
                            <td className="py-2 px-2 text-right text-red-600">
                              -{snapshot.outForDelivery}
                            </td>
                            <td className="py-2 px-2 text-right font-medium">
                              {snapshot.finalStock}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Stock Info */}
          <div className="space-y-6">
            {/* Seller Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Store className="h-4 w-4" />
                  Seller Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <p className="text-xs text-muted-foreground">Seller</p>
                  <p className="font-semibold">{product.seller.name}</p>
                </div>
              </CardContent>
            </Card>

            {/* Stock Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Warehouse className="h-4 w-4" />
                  Stock Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Stock</p>
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "text-2xl font-bold",
                        lowStock ? "text-orange-600" : "text-emerald-600"
                      )}
                    >
                      {totalStock}
                    </p>
                    {lowStock && (
                      <Badge variant="destructive" className="text-xs">
                        Low Stock
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Warehouse Filter */}
                {user.role === 'ADMIN' || role === 'SUPER_ADMIN' && warehouses.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs">Filter by Warehouse</Label>
                    <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Warehouses</SelectItem>
                        {warehouses.map((wh) => (
                          <SelectItem key={wh.id} value={wh.id}>
                            {wh.name} ({wh.city})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Stock by Warehouse */}
                {filteredStocks.length > 0 ? (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      By Warehouse
                    </p>
                    {filteredStocks.map((stock) => (
                      <div
                        key={stock.id}
                        className={cn(
                          "flex justify-between items-center text-sm p-2 rounded cursor-pointer hover:bg-muted transition-colors",
                          selectedStockId === stock.id && "bg-muted"
                        )}
                        onClick={() => setSelectedStockId(stock.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">
                            {stock.warehouse?.name || 'No Warehouse'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {stock.warehouse?.city}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-bold",
                              stock.quantity <= stock.alertLevel ? "text-orange-600" : ""
                            )}
                          >
                            {stock.quantity}
                          </span>
                          {stock.quantity <= stock.alertLevel && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-orange-200 text-orange-600">
                              Alert: {stock.alertLevel}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No stock records</p>
                )}

                {/* Manual Stock Movement Buttons */}
                {(user.role === 'ADMIN' || role === 'SUPER_ADMIN' || user.role === 'SELLER') && selectedStock && (
                  <div className="grid grid-cols-2 gap-2 pt-4 border-t">
                    <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setMovementType('IN')}
                        >
                          <ArrowDownRight className="mr-1 h-3 w-3 text-emerald-600" />
                          Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <form onSubmit={handleStockMovement}>
                          <DialogHeader>
                            <DialogTitle>Stock In</DialogTitle>
                            <DialogDescription>
                              Add stock to {product.name}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                              <Label>Quantity *</Label>
                              <Input
                                type="number"
                                min="1"
                                value={movementQuantity}
                                onChange={(e) => setMovementQuantity(e.target.value)}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Reason *</Label>
                              <Textarea
                                placeholder="e.g., New shipment arrived"
                                value={movementReason}
                                onChange={(e) => setMovementReason(e.target.value)}
                                rows={2}
                                required
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setMovementDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={submittingMovement}>
                              {submittingMovement ? 'Adding...' : 'Add Stock'}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={selectedStock.quantity === 0}
                          onClick={() => setMovementType('OUT')}
                        >
                          <ArrowUpRight className="mr-1 h-3 w-3 text-red-600" />
                          Remove
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <form onSubmit={handleStockMovement}>
                          <DialogHeader>
                            <DialogTitle>Stock Out</DialogTitle>
                            <DialogDescription>
                              Remove stock from {product.name}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                              <Label>Quantity *</Label>
                              <Input
                                type="number"
                                min="1"
                                max={selectedStock.quantity}
                                value={movementQuantity}
                                onChange={(e) => setMovementQuantity(e.target.value)}
                                required
                              />
                              <p className="text-xs text-muted-foreground">
                                Available: {selectedStock.quantity}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>Reason *</Label>
                              <Textarea
                                placeholder="e.g., Damaged goods, returned item"
                                value={movementReason}
                                onChange={(e) => setMovementReason(e.target.value)}
                                rows={2}
                                required
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setMovementDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" variant="destructive" disabled={submittingMovement}>
                              {submittingMovement ? 'Removing...' : 'Remove Stock'}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
