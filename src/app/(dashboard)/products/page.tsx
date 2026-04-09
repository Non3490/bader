'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useUser } from '@/hooks/use-user'
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Image as ImageIcon,
  MoreHorizontal,
  Edit,
  Trash2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  sku: string
  name: string
  shortDescription: string | null
  imageUrl: string | null
  costPrice: number | null
  sellPrice: number
  isActive: boolean
  totalStock: number
  stocks: Array<{
    id: string
    warehouse: { name: string; city: string } | null
    quantity: number
    alertLevel: number
  }>
}

interface Warehouse {
  id: string
  name: string
  city: string
}

export default function ProductsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Auth is handled by layout - this page is accessible to all authenticated users

  const fetchData = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      const [productsRes, warehousesRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/warehouses'),
      ])

      if (productsRes.ok) {
        const data = await productsRes.json()
        setProducts(data.products || [])
      }

      if (warehousesRes.ok) {
        const data = await warehousesRes.json()
        setWarehouses(data.warehouses || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [fetchData, user])

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return
    }

    setDeletingId(productId)
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete product')
      }

      toast.success('Product deleted successfully')
      fetchData()
    } catch (error) {
      console.error('Delete product error:', error)
      toast.error('Failed to delete product')
    } finally {
      setDeletingId(null)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GA', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    if (selectedWarehouse !== 'all') {
      const stockInWarehouse = product.stocks.some(
        (s) => s.warehouse?.id === selectedWarehouse
      )
      if (!stockInWarehouse) return false
    }

    if (statusFilter === 'out' && product.totalStock !== 0) return false
    if (statusFilter === 'low' && !(product.totalStock > 0 && product.totalStock <= 10)) return false

    return true
  })

  if (userLoading || loading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </>
    )
  }

  if (!user) return null

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Products</h1>
            <p className="text-muted-foreground">
              Manage your product catalog and inventory
            </p>
          </div>
          <Button onClick={() => router.push('/products/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && warehouses.length > 0 && (
                <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
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
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="out">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardContent className="p-0">
            {filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No products found</p>
                {searchQuery === '' && (
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={() => router.push('/products/new')}
                  >
                    Create your first product
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="py-3 px-4 text-left text-sm font-medium">Image</th>
                      <th className="py-3 px-4 text-left text-sm font-medium">Product Name</th>
                      <th className="py-3 px-4 text-left text-sm font-medium">SKU</th>
                      <th className="py-3 px-4 text-right text-sm font-medium">Stock Qty</th>
                      <th className="py-3 px-4 text-right text-sm font-medium">Selling Price</th>
                      <th className="py-3 px-4 text-center text-sm font-medium">Status</th>
                      <th className="py-3 px-4 text-right text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredProducts.map((product) => {
                      const isLowStock = product.totalStock > 0 && product.totalStock <= 10
                      const isOutOfStock = product.totalStock === 0

                      return (
                        <tr
                          key={product.id}
                          className={cn(
                            "hover:bg-muted/50 transition-colors",
                            !product.isActive && "opacity-50"
                          )}
                        >
                          <td className="py-3 px-4">
                            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="h-10 w-10 object-cover"
                                />
                              ) : (
                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium">{product.name}</p>
                              {product.shortDescription && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {product.shortDescription}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-sm">{product.sku}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-bold">{product.totalStock}</span>
                              {isLowStock && (
                                <Badge variant="secondary" className="gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Low
                                </Badge>
                              )}
                              {isOutOfStock && (
                                <Badge variant="destructive">Out</Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-medium">
                            {formatCurrency(product.sellPrice)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant={product.isActive ? 'default' : 'secondary'}>
                              {product.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => router.push(`/products/${product.id}`)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  View / Edit
                                </DropdownMenuItem>
                                {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'SELLER') && (
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(product.id)}
                                    disabled={deletingId === product.id}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
