'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Plus, 
  Search, 
  RefreshCcw, 
  Edit2, 
  Trash2, 
  Package, 
  CheckCircle2, 
  XCircle,
  Image as ImageIcon,
  Tag,
  Globe2,
  ChevronRight,
  MoreHorizontal,
  LayoutGrid,
  Activity
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CatalogProduct {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  costPrice: number
  category: string | null
  countryAvailable: string | null
  isActive: boolean
  createdAt: string
}

export default function AdminCatalogPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    costPrice: '',
    category: '',
    countryAvailable: 'Gabon',
    isActive: true
  })

  useEffect(() => {
    if (!userLoading && (!user || user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      router.push('/login')
    }
  }, [user, userLoading, router])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/catalog?${params}`)
      if (res.ok) {
        const data = await res.json()
        setProducts(data.products)
      }
    } catch (error) {
      toast.error('Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
      return
    }
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      router.push('/unauthorized')
      return
    }
    fetchProducts()
  }, [user, userLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const url = editingProduct ? `/api/catalog/${editingProduct.id}` : '/api/catalog'
      const method = editingProduct ? 'PATCH' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          costPrice: parseFloat(formData.costPrice)
        })
      })

      if (res.ok) {
        toast.success(`Product ${editingProduct ? 'updated' : 'created'} successfully`)
        setDialogOpen(false)
        resetForm()
        fetchProducts()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Something went wrong')
      }
    } catch (error) {
      toast.error('Failed to save product')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    try {
      const res = await fetch(`/api/catalog/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Product deleted')
        fetchProducts()
      }
    } catch (error) {
      toast.error('Failed to delete product')
    }
  }

  const toggleStatus = async (product: CatalogProduct) => {
    try {
      const res = await fetch(`/api/catalog/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive })
      })
      if (res.ok) {
        toast.success(`Product ${!product.isActive ? 'activated' : 'deactivated'}`)
        fetchProducts()
      }
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      imageUrl: '',
      costPrice: '',
      category: '',
      countryAvailable: 'Gabon',
      isActive: true
    })
    setEditingProduct(null)
  }

  const handleEdit = (product: CatalogProduct) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || '',
      imageUrl: product.imageUrl || '',
      costPrice: product.costPrice.toString(),
      category: product.category || '',
      countryAvailable: product.countryAvailable || 'Gabon',
      isActive: product.isActive
    })
    setDialogOpen(true)
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-GA', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(v)

  if (userLoading || !user) return null

  const activeCount = products.filter(p => p.isActive).length
  const avgPrice = products.length > 0 ? products.reduce((acc, p) => acc + p.costPrice, 0) / products.length : 0

  return (
    <>
      <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <span>Admin</span>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground">Catalog</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              Product Catalog
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Curate and manage premium products available for your seller network.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="lg" 
              onClick={fetchProducts}
              className="bg-background/50 backdrop-blur-sm border-2 hover:bg-accent transition-all active:scale-95"
            >
              <RefreshCcw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Sync Data
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="lg" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95 px-6">
                  <Plus className="mr-2 h-5 w-5" />
                  New Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden border-none shadow-2xl">
                <form onSubmit={handleSubmit}>
                  <div className="bg-primary/5 px-6 py-8 border-b border-primary/10">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold tracking-tight">
                        {editingProduct ? 'Update Product' : 'Create New Offering'}
                      </DialogTitle>
                      <DialogDescription className="text-base">
                        Add high-quality product details to attract more sellers.
                      </DialogDescription>
                    </DialogHeader>
                  </div>
                  
                  <div className="grid gap-6 p-6 md:grid-cols-2 bg-background">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="name" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Product Name</Label>
                      <Input 
                        id="name" 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                        placeholder="e.g. Ultra-HD Wireless Headphones"
                        className="h-12 text-lg focus-visible:ring-primary/30 transition-all"
                        required 
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="costPrice" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Base Cost (XAF)</Label>
                      <div className="relative">
                        <Input 
                          id="costPrice" 
                          type="number"
                          value={formData.costPrice} 
                          onChange={e => setFormData({...formData, costPrice: e.target.value})} 
                          placeholder="0.00"
                          className="h-11 pl-10 focus-visible:ring-primary/30"
                          required 
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">FCFA</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Category</Label>
                      <div className="relative">
                        <Input 
                          id="category" 
                          value={formData.category} 
                          onChange={e => setFormData({...formData, category: e.target.value})} 
                          placeholder="e.g. Electronics"
                          className="h-11 pl-10 focus-visible:ring-primary/30"
                        />
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="description" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Detailed Description</Label>
                      <Textarea 
                        id="description" 
                        value={formData.description} 
                        onChange={e => setFormData({...formData, description: e.target.value})} 
                        placeholder="Describe features, dimensions, and selling points..."
                        rows={4}
                        className="resize-none focus-visible:ring-primary/30 text-base"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="imageUrl" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Asset URL</Label>
                      <div className="relative">
                        <Input 
                          id="imageUrl" 
                          value={formData.imageUrl} 
                          onChange={e => setFormData({...formData, imageUrl: e.target.value})} 
                          placeholder="https://cloud.storage/product.jpg"
                          className="h-11 pl-10 focus-visible:ring-primary/30"
                        />
                        <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="countryAvailable" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Fulfillment Region</Label>
                      <div className="relative">
                        <Input 
                          id="countryAvailable" 
                          value={formData.countryAvailable} 
                          onChange={e => setFormData({...formData, countryAvailable: e.target.value})} 
                          placeholder="e.g. Gabon"
                          className="h-11 pl-10 focus-visible:ring-primary/30"
                        />
                        <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 border-t flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="px-6 font-medium">Cancel</Button>
                    <Button type="submit" disabled={submitting} className="px-8 font-bold shadow-md active:scale-95 transition-all">
                      {submitting ? (
                        <span className="flex items-center gap-2">
                          <RefreshCcw className="h-4 w-4 animate-spin" /> Saving...
                        </span>
                      ) : (
                        editingProduct ? 'Update Product' : 'Publish Product'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Total Listings</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{products.length}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-emerald-500/[0.03]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Active Units</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{activeCount}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-indigo-500/[0.03]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Avg. Cost</CardTitle>
              <Activity className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">{fmt(avgPrice)}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-amber-500/[0.03]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Visibility Rate</CardTitle>
              <LayoutGrid className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{products.length > 0 ? Math.round((activeCount / products.length) * 100) : 0}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Inventory Control Card */}
        <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden">
          <CardHeader className="bg-slate-50/80 border-b pb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-xl font-bold">Inventory Control</CardTitle>
              <div className="relative w-full md:w-[380px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter products by name or SKU..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchProducts()}
                  className="pl-9 h-11 bg-background border-none shadow-inner transition-all focus-visible:ring-primary/20"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[100px] font-bold py-5 pl-8 text-slate-500 uppercase text-[11px] tracking-widest">Image</TableHead>
                    <TableHead className="font-bold py-5 text-slate-500 uppercase text-[11px] tracking-widest">Product Details</TableHead>
                    <TableHead className="font-bold py-5 text-slate-500 uppercase text-[11px] tracking-widest">Category</TableHead>
                    <TableHead className="font-bold py-5 text-slate-500 uppercase text-[11px] tracking-widest">Inventory Cost</TableHead>
                    <TableHead className="font-bold py-5 text-slate-500 uppercase text-[11px] tracking-widest text-center">Market</TableHead>
                    <TableHead className="font-bold py-5 text-slate-500 uppercase text-[11px] tracking-widest text-center">Status</TableHead>
                    <TableHead className="font-bold py-5 pr-8 text-slate-500 uppercase text-[11px] tracking-widest text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="p-4 bg-slate-100 rounded-full">
                            <Package className="h-10 w-10 text-slate-400" />
                          </div>
                          <p className="text-lg font-medium text-slate-500">{loading ? 'Synchronizing catalog...' : 'No products found in your inventory.'}</p>
                          {!loading && (
                            <Button variant="outline" size="sm" onClick={() => {setSearch(''); fetchProducts();}}>Clear Filters</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product) => (
                      <TableRow key={product.id} className="group hover:bg-slate-50/50 transition-colors">
                        <TableCell className="py-4 pl-8">
                          {product.imageUrl ? (
                            <div className="relative h-14 w-14 rounded-xl overflow-hidden border shadow-sm group-hover:scale-110 transition-transform">
                              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                            </div>
                          ) : (
                            <div className="h-14 w-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-dashed border-slate-300">
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col space-y-0.5">
                            <span className="font-bold text-slate-800 text-base">{product.name}</span>
                            <span className="text-[11px] text-muted-foreground font-mono bg-slate-100 w-fit px-1.5 py-0.5 rounded uppercase tracking-wider">SKU: {product.id.slice(-8)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          {product.category ? (
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center mr-2">
                                <Tag className="h-3.5 w-3.5 text-indigo-500" />
                              </div>
                              <span className="font-medium text-slate-600">{product.category}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-sm">Uncategorized</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-900 text-lg">{fmt(product.costPrice)}</span>
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase">Cost Per Unit</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-center">
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold border-none px-3 py-1">
                            <Globe2 className="mr-1.5 h-3.5 w-3.5" />
                            {product.countryAvailable}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 text-center">
                          <button
                            onClick={() => toggleStatus(product)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm active:scale-95",
                              product.isActive 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100" 
                                : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                            )}
                          >
                            <div className={cn("h-1.5 w-1.5 rounded-full", product.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                            {product.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </button>
                        </TableCell>
                        <TableCell className="py-4 pr-8 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-slate-200/50 rounded-full transition-all">
                                <MoreHorizontal className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 p-2 shadow-2xl border-slate-200/60">
                              <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground font-bold px-3 py-2">Management</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleEdit(product)} className="rounded-md px-3 py-2.5 cursor-pointer focus:bg-primary/5 focus:text-primary transition-colors">
                                <Edit2 className="mr-3 h-4 w-4" />
                                <span className="font-medium">Modify Details</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleStatus(product)} className="rounded-md px-3 py-2.5 cursor-pointer focus:bg-primary/5 transition-colors">
                                {product.isActive ? (
                                  <><XCircle className="mr-3 h-4 w-4 text-amber-500" /><span className="font-medium">Deactivate Listing</span></>
                                ) : (
                                  <><CheckCircle2 className="mr-3 h-4 w-4 text-emerald-500" /><span className="font-medium">Activate Listing</span></>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="my-2" />
                              <DropdownMenuItem 
                                onClick={() => handleDelete(product.id)} 
                                className="rounded-md px-3 py-2.5 cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors font-semibold"
                              >
                                <Trash2 className="mr-3 h-4 w-4" />
                                Remove Permanently
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {products.length > 0 && (
              <div className="bg-slate-50/50 border-t p-4 px-8 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Showing {products.length} cataloged products
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 px-3 font-bold border-2" disabled>Previous</Button>
                  <Button variant="outline" size="sm" className="h-8 px-3 font-bold border-2" disabled>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
