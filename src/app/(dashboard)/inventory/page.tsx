'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUser } from '@/hooks/use-user'
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Warehouse,
  TrendingDown,
  TrendingUp,
  RefreshCcw,
  Edit,
  ArrowUpRight,
  ArrowDownRight,
  History
} from 'lucide-react'
import { Link } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DailyReport } from '@/components/inventory/DailyReport'

interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  costPrice: number
  sellPrice: number
  stock: number
  warehouse: string | null
  lowStockAlert: number
  active: boolean
  movements: Array<{
    id: string
    quantity: number
    type: string
    reason: string
    createdAt: string
  }>
}

interface StockMovement {
  id: string
  productId: string
  productName: string
  productSku: string
  quantity: number
  type: string
  reason: string
  createdAt: string
}

export default function InventoryPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string; city: string }>>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out'>('all')
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [movementDialogOpen, setMovementDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    outOfStock: 0,
    totalValue: 0
  })

  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    description: '',
    costPrice: '',
    sellPrice: '',
    stock: '0',
    warehouse: '',
    lowStockAlert: '10'
  })

  const [movementForm, setMovementForm] = useState({
    type: 'IN',
    quantity: '',
    reason: ''
  })

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    }
  }, [user, userLoading, router])

  useEffect(() => {
    const warehouse = new URLSearchParams(window.location.search).get('warehouse')
    if (warehouse) {
      setSelectedWarehouse(warehouse)
    }
  }, [])

  const fetchData = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      const [productsRes, movementsRes, warehousesRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/stock-movements'),
        fetch('/api/warehouses')
      ])

      if (productsRes.ok) {
        const data = await productsRes.json()
        setProducts(data.products)
        setStats(data.stats)
      }

      if (movementsRes.ok) {
        const data = await movementsRes.json()
        setMovements(data.movements)
      }

      if (warehousesRes.ok) {
        const data = await warehousesRes.json()
        setWarehouses(data.warehouses || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [fetchData, user])

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productForm,
          costPrice: parseFloat(productForm.costPrice),
          sellPrice: parseFloat(productForm.sellPrice),
          stock: parseInt(productForm.stock),
          lowStockAlert: parseInt(productForm.lowStockAlert)
        })
      })

      if (!res.ok) throw new Error('Failed to create product')

      toast.success('Product created successfully')
      setCreateDialogOpen(false)
      setProductForm({
        sku: '',
        name: '',
        description: '',
        costPrice: '',
        sellPrice: '',
        stock: '0',
        warehouse: '',
        lowStockAlert: '10'
      })
      fetchData()
    } catch (error) {
      console.error('Create product error:', error)
      toast.error('Failed to create product')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStockMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) return

    setSubmitting(true)

    try {
      const res = await fetch('/api/stock-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          type: movementForm.type,
          quantity: parseInt(movementForm.quantity),
          reason: movementForm.reason
        })
      })

      if (!res.ok) throw new Error('Failed to record movement')

      toast.success('Stock movement recorded')
      setMovementDialogOpen(false)
      setMovementForm({ type: 'IN', quantity: '', reason: '' })
      setSelectedProduct(null)
      fetchData()
    } catch (error) {
      console.error('Movement error:', error)
      toast.error('Failed to record movement')
    } finally {
      setSubmitting(false)
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase())

    // Filter by warehouse (if selected)
    const matchesWarehouse =
      selectedWarehouse === 'all' || product.warehouse?.includes(selectedWarehouse)

    // Filter by status
    if (filterStatus === 'low') {
      return matchesSearch && matchesWarehouse && product.stock > 0 && product.stock <= product.lowStockAlert
    }
    if (filterStatus === 'out') {
      return matchesSearch && matchesWarehouse && product.stock === 0
    }
    return matchesSearch && matchesWarehouse
  })

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <>
      <Tabs defaultValue="inventory" className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Stock Management</h1>
            <p className="text-muted-foreground">
              Manage inventory and track stock movements
            </p>
          </div>

          <TabsList className="hidden sm:flex">
             <TabsTrigger value="inventory">Live Inventory</TabsTrigger>
             <TabsTrigger value="daily-report">Daily Report</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {user.role === 'ADMIN' || role === 'SUPER_ADMIN' && (
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreateProduct}>
                    <DialogHeader>
                      <DialogTitle>Add New Product</DialogTitle>
                      <DialogDescription>
                        Enter product details to add to inventory
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="sku">SKU *</Label>
                          <Input
                            id="sku"
                            value={productForm.sku}
                            onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="name">Name *</Label>
                          <Input
                            id="name"
                            value={productForm.name}
                            onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={productForm.description}
                          onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="costPrice">Cost Price</Label>
                          <Input
                            id="costPrice"
                            type="number"
                            step="0.01"
                            value={productForm.costPrice}
                            onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sellPrice">Sell Price</Label>
                          <Input
                            id="sellPrice"
                            type="number"
                            step="0.01"
                            value={productForm.sellPrice}
                            onChange={(e) => setProductForm({ ...productForm, sellPrice: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="stock">Initial Stock</Label>
                          <Input
                            id="stock"
                            type="number"
                            value={productForm.stock}
                            onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lowStockAlert">Low Stock Alert</Label>
                          <Input
                            id="lowStockAlert"
                            type="number"
                            value={productForm.lowStockAlert}
                            onChange={(e) => setProductForm({ ...productForm, lowStockAlert: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="warehouse">Warehouse/Location</Label>
                        <Input
                          id="warehouse"
                          value={productForm.warehouse}
                          onChange={(e) => setProductForm({ ...productForm, warehouse: e.target.value })}
                          placeholder="e.g., Libreville Warehouse"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={submitting}>
                        {submitting ? 'Creating...' : 'Create Product'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <TabsContent value="inventory" className="space-y-6 mt-0">
          {/* Stats */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                    <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalProducts}</p>
                    <p className="text-sm text-muted-foreground">Total Products</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={stats.lowStock > 0 ? "border-yellow-500" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="bg-yellow-100 dark:bg-yellow-900 p-2 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.lowStock}</p>
                    <p className="text-sm text-muted-foreground">Low Stock</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={stats.outOfStock > 0 ? "border-red-500" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="bg-red-100 dark:bg-red-900 p-2 rounded-lg">
                    <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.outOfStock}</p>
                    <p className="text-sm text-muted-foreground">Out of Stock</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                    <Warehouse className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
                    <p className="text-sm text-muted-foreground">Stock Value</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="out">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
                {warehouses.length > 0 && (
                  <Select value={selectedWarehouse} onValueChange={(value) => {
                    setSelectedWarehouse(value)
                    // Update URL query param for shareable links
                    const url = new URL(window.location.href)
                    if (value === 'all') {
                      url.searchParams.delete('warehouse')
                    } else {
                      url.searchParams.set('warehouse', value)
                    }
                    router.replace(url.pathname + url.search)
                  }}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="All Warehouses" />
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
                )}
              </div>
            </CardContent>
          </Card>

          {/* Products Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No products found</p>
                </CardContent>
              </Card>
            ) : (
              filteredProducts.map((product) => (
                <Card key={product.id} className={cn(
                  product.stock === 0 && "border-red-300 dark:border-red-800",
                  product.stock > 0 && product.stock <= product.lowStockAlert && "border-yellow-300 dark:border-yellow-800"
                )}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        <CardDescription className="font-mono">{product.sku}</CardDescription>
                      </div>
                      <Badge variant={product.stock === 0 ? "destructive" : product.stock <= product.lowStockAlert ? "secondary" : "outline"}>
                        {product.stock === 0 ? "Out" : product.stock <= product.lowStockAlert ? "Low" : "In Stock"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {product.warehouse && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Warehouse className="h-3 w-3" />
                        {product.warehouse}
                      </p>
                    )}

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Stock</span>
                      <span className={cn(
                        "text-2xl font-bold",
                        product.stock === 0 && "text-red-600",
                        product.stock > 0 && product.stock <= product.lowStockAlert && "text-yellow-600"
                      )}>
                        {product.stock}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Cost</p>
                        <p className="font-medium">{formatCurrency(product.costPrice)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Sell</p>
                        <p className="font-medium">{formatCurrency(product.sellPrice)}</p>
                      </div>
                    </div>

                    {user.role === 'ADMIN' || role === 'SUPER_ADMIN' && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setSelectedProduct(product)
                            setMovementForm({ type: 'IN', quantity: '', reason: '' })
                            setMovementDialogOpen(true)
                          }}
                        >
                          <ArrowDownRight className="mr-1 h-3 w-3 text-green-600" />
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setSelectedProduct(product)
                            setMovementForm({ type: 'OUT', quantity: '', reason: '' })
                            setMovementDialogOpen(true)
                          }}
                          disabled={product.stock === 0}
                        >
                          <ArrowUpRight className="mr-1 h-3 w-3 text-red-600" />
                          Remove
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Recent Movements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Stock Movements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No movements recorded yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Product</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Type</th>
                        <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Quantity</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.slice(0, 10).map((movement) => (
                        <tr key={movement.id} className="border-b last:border-0">
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {formatDate(movement.createdAt)}
                          </td>
                          <td className="py-3 px-2">
                            <div>
                              <span className="font-medium text-sm">{movement.productName}</span>
                              <span className="text-xs text-muted-foreground ml-2">({movement.productSku})</span>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <Badge variant={movement.type === 'IN' ? 'default' : 'destructive'}>
                              {movement.type === 'IN' ? (
                                <ArrowDownRight className="mr-1 h-3 w-3" />
                              ) : (
                                <ArrowUpRight className="mr-1 h-3 w-3" />
                              )}
                              {movement.type}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-right font-medium">
                            {movement.type === 'IN' ? '+' : '-'}{movement.quantity}
                          </td>
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {movement.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stock Movement Dialog */}
          <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
            <DialogContent>
              <form onSubmit={handleStockMovement}>
                <DialogHeader>
                  <DialogTitle>
                    {movementForm.type === 'IN' ? 'Add Stock' : 'Remove Stock'}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedProduct?.name} ({selectedProduct?.sku})
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Movement Type</Label>
                    <Select
                      value={movementForm.type}
                      onValueChange={(v) => setMovementForm({ ...movementForm, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IN">Stock In (Add)</SelectItem>
                        <SelectItem value="OUT">Stock Out (Remove)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      max={movementForm.type === 'OUT' ? selectedProduct?.stock : undefined}
                      value={movementForm.quantity}
                      onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason *</Label>
                    <Textarea
                      id="reason"
                      placeholder="e.g., New shipment, Damaged goods, Returned item..."
                      value={movementForm.reason}
                      onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                      required
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setMovementDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    variant={movementForm.type === 'OUT' ? 'destructive' : 'default'}
                  >
                    {submitting ? 'Processing...' : movementForm.type === 'IN' ? 'Add Stock' : 'Remove Stock'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="daily-report" className="mt-0">
          <DailyReport />
        </TabsContent>
      </Tabs>
    </>
  )
}
