'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ImportOrderDialog } from '@/components/orders/ImportOrderDialog'
import { PrintLabelsButton } from '@/components/orders/PrintLabelsButton'
import { useUser } from '@/hooks/use-user'
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Trash,
  Package,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
  Calendar,
  Layers,
  DollarSign,
  ArrowRight,
  Download
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Order {
  id: string
  trackingNumber: string
  customerName: string
  customerPhone: string
  customerAddress: string
  city: string
  productName: string
  quantity: number
  codAmount: number
  status: string
  source: string
  createdAt: string
  user?: {
    id: string
    name: string
    email: string
    role: string
  }
}

interface OrdersResponse {
  orders: Order[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  NEW: {
    label: 'New Order',
    color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    dot: 'bg-amber-500'
  },
  CONFIRMED: {
    label: 'Confirmed',
    color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    dot: 'bg-blue-500'
  },
  SHIPPED: {
    label: 'Shipped',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800',
    dot: 'bg-indigo-500'
  },
  DELIVERED: {
    label: 'Delivered',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    dot: 'bg-emerald-500'
  },
  RETURNED: {
    label: 'Returned',
    color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800',
    dot: 'bg-rose-500'
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800',
    dot: 'bg-slate-500'
  },
  POSTPONED: {
    label: 'Postponed',
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800',
    dot: 'bg-yellow-500'
  },
  NO_ANSWER: {
    label: 'No Answer',
    color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800',
    dot: 'bg-orange-500'
  },
  BUSY: {
    label: 'Busy',
    color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800',
    dot: 'bg-orange-500'
  },
  CALLBACK: {
    label: 'Callback',
    color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    dot: 'bg-blue-500'
  },
  UNREACHED: {
    label: 'Unreachable',
    color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    dot: 'bg-red-500'
  },
  WRONG_NUMBER: {
    label: 'Wrong Number',
    color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    dot: 'bg-red-500'
  },
  DOUBLE: {
    label: 'Double Order',
    color: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800',
    dot: 'bg-gray-500'
  },
  RETURN_TO_STOCK: {
    label: 'Return to Stock',
    color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
    dot: 'bg-purple-500'
  }
}

const statusOptions = [
  { value: 'ALL', label: 'All Status' },
  { value: 'NEW', label: 'New' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'POSTPONED', label: 'Postponed' },
  { value: 'NO_ANSWER', label: 'No Answer' },
  { value: 'BUSY', label: 'Busy' },
  { value: 'CALLBACK', label: 'Callback' },
  { value: 'UNREACHED', label: 'Unreachable' },
  { value: 'WRONG_NUMBER', label: 'Wrong Number' },
  { value: 'DOUBLE', label: 'Double Order' },
  { value: 'RETURN_TO_STOCK', label: 'Return to Stock' }
]

const sourceConfig: Record<string, { label: string; color: string }> = {
  MANUAL: { label: 'Manual', color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800' },
  CSV: { label: 'CSV Import', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' },
  SHEETS: { label: 'Google Sheets', color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' },
  SHOPIFY: { label: 'Shopify', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' },
  YOUCAN: { label: 'YouCan', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800' },
  DROPIFY: { label: 'Dropify', color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800' },
  LIGHTFUNNELS: { label: 'LightFunnels', color: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800' }
}

const sourceOptions = [
  { value: 'ALL', label: 'All Sources' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'CSV', label: 'CSV Import' },
  { value: 'SHEETS', label: 'Google Sheets' },
  { value: 'SHOPIFY', label: 'Shopify' },
  { value: 'YOUCAN', label: 'YouCan' },
  { value: 'DROPIFY', label: 'Dropify' },
  { value: 'LIGHTFUNNELS', label: 'LightFunnels' }
]

// Inner component that uses useSearchParams
function OrdersPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: userLoading } = useUser()

  const [data, setData] = useState<OrdersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL')
  const [sourceFilter, setSourceFilter] = useState(searchParams.get('source') || 'ALL')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [selectedOrders, setSelectedOrders] = useState<Order[]>([])

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    city: '',
    productName: '',
    productSku: '',
    quantity: '1',
    codAmount: '',
    productCost: '0',
    shippingCost: '0',
    callCenterFee: '0',
    adSpend: '0',
    notes: ''
  })

  const page = parseInt(searchParams.get('page') || '1')

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    }
  }, [user, userLoading, router])

  const fetchOrders = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (sourceFilter !== 'ALL') params.set('source', sourceFilter)
      if (searchQuery) params.set('search', searchQuery)

      const response = await fetch(`/api/orders?${params.toString()}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      toast.error('Failed to load orders. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [user, page, statusFilter, sourceFilter, searchQuery])

  useEffect(() => {
    if (user) {
      fetchOrders()
    }
  }, [fetchOrders, user])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    params.set('page', '1')
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    if (sourceFilter !== 'ALL') params.set('source', sourceFilter)
    if (searchQuery) params.set('search', searchQuery)
    router.push(`/orders?${params.toString()}`)
  }

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          quantity: parseInt(formData.quantity),
          codAmount: parseFloat(formData.codAmount),
          productCost: parseFloat(formData.productCost),
          shippingCost: parseFloat(formData.shippingCost),
          callCenterFee: parseFloat(formData.callCenterFee),
          adSpend: parseFloat(formData.adSpend)
        })
      })

      if (response.ok) {
        toast.success('Order created successfully')
        setCreateDialogOpen(false)
        setFormData({
          customerName: '',
          customerPhone: '',
          customerAddress: '',
          city: '',
          productName: '',
          productSku: '',
          quantity: '1',
          codAmount: '',
          productCost: '0',
          shippingCost: '0',
          callCenterFee: '0',
          adSpend: '0',
          notes: ''
        })
        fetchOrders()
      } else {
        const err = await response.json().catch(() => ({}))
        toast.error(err.error || 'Failed to create order')
      }
    } catch (error) {
      toast.error('Failed to create order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Order deleted')
        fetchOrders()
      } else {
        toast.error('Failed to delete order')
      }
    } catch (error) {
      toast.error('Failed to delete order. Please try again.')
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (sourceFilter !== 'ALL') params.set('source', sourceFilter)
      if (searchQuery) params.set('search', searchQuery)

      const response = await fetch(`/api/orders/export?${params.toString()}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `orders-export-${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Export downloaded successfully')
      } else {
        toast.error('Failed to export orders')
      }
    } catch (error) {
      toast.error('Failed to export orders. Please try again.')
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GA', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(value)
  }

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading orders...</p>
        </div>
      </div>
    )
  }

  if (!user || !data) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
        {/* Modern Header Section with Gradient Overlay */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-8 py-10 text-white shadow-2xl dark:bg-slate-900">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
          
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight">Order Management</h1>
              </div>
              <p className="text-slate-400 max-w-md">
                Monitor performance, manage fulfillments, and track your COD deliveries in real-time.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchOrders}
                className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Sync
              </Button>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                    <Plus className="mr-2 h-4 w-4" />
                    New Order
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-none shadow-2xl">
                  <form onSubmit={handleCreateOrder}>
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold">Create New Order</DialogTitle>
                      <DialogDescription>
                        Fill in the customer and product details below.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="customerName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer Name</Label>
                          <Input
                            id="customerName"
                            className="bg-muted/50 focus:bg-background transition-all"
                            value={formData.customerName}
                            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="customerPhone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone Number</Label>
                          <Input
                            id="customerPhone"
                            className="bg-muted/50 focus:bg-background transition-all"
                            value={formData.customerPhone}
                            onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customerAddress" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shipping Address</Label>
                        <Input
                          id="customerAddress"
                          className="bg-muted/50 focus:bg-background transition-all"
                          value={formData.customerAddress}
                          onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">City</Label>
                          <Input
                            id="city"
                            className="bg-muted/50 focus:bg-background transition-all"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="productName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</Label>
                          <Input
                            id="productName"
                            className="bg-muted/50 focus:bg-background transition-all"
                            value={formData.productName}
                            onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="productSku" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SKU</Label>
                          <Input
                            id="productSku"
                            className="bg-muted/50"
                            value={formData.productSku}
                            onChange={(e) => setFormData({ ...formData, productSku: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="quantity" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qty</Label>
                          <Input
                            id="quantity"
                            type="number"
                            min="1"
                            className="bg-muted/50"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="codAmount" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">COD Amount</Label>
                          <Input
                            id="codAmount"
                            type="number"
                            step="0.01"
                            className="bg-muted/50 font-bold text-primary"
                            value={formData.codAmount}
                            onChange={(e) => setFormData({ ...formData, codAmount: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Additional Notes</Label>
                        <Textarea
                          id="notes"
                          className="bg-muted/50 min-h-[80px]"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter className="gap-2">
                      <Button type="button" variant="ghost" onClick={() => setCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={submitting} className="min-w-[140px]">
                        {submitting ? 'Processing...' : 'Confirm Order'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                <ImportOrderDialog onImportSuccess={fetchOrders} />
                <div className="h-6 w-px bg-white/10" />
                <PrintLabelsButton selectedOrders={selectedOrders} onPrintComplete={() => setSelectedOrders([])} />
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Card className="lg:col-span-3 border-none shadow-sm bg-muted/30">
            <CardContent className="p-3">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    placeholder="Search customer, phone, or tracking ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-none bg-background shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 transition-all h-11"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[200px] border-none bg-background shadow-none h-11">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="border-none shadow-xl">
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="py-2.5">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] border-none bg-background shadow-none h-11">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Source" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="border-none shadow-xl">
                    {sourceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="py-2.5">
                        <Badge className={cn('mr-2', sourceConfig[option.value]?.color, option.value === 'ALL' && 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800')}>
                          {option.label}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" size="lg" className="h-11 px-6 shadow-md shadow-primary/10">
                  Search
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-primary/5 hidden lg:flex items-center justify-center p-4">
             <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">Total Active</p>
                <p className="text-3xl font-black text-primary">{data.pagination.total}</p>
             </div>
          </Card>
        </div>

        {/* Orders Table Section */}
        <div className="rounded-3xl border bg-card shadow-sm overflow-hidden">
          <div className="p-6 border-b flex items-center justify-between bg-muted/10">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-lg">Order Registry</h2>
            </div>
            {selectedOrders.length > 0 && (
              <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-none py-1 px-3">
                  {selectedOrders.length} selected
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setSelectedOrders([])} className="text-xs h-8">
                  Clear
                </Button>
              </div>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/5">
                  <th className="py-4 px-6 text-left w-12">
                    <Checkbox
                      className="rounded-[4px]"
                      checked={selectedOrders.length === data.orders.length && data.orders.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedOrders([...data.orders])
                        else setSelectedOrders([])
                      }}
                    />
                  </th>
                  <th className="py-4 px-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Order Details</th>
                  <th className="py-4 px-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer</th>
                  <th className="py-4 px-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Source</th>
                  <th className="py-4 px-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Product info</th>
                  <th className="py-4 px-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Location</th>
                  <th className="py-4 px-4 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Value</th>
                  <th className="py-4 px-4 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="py-4 px-6 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/10">
                {data.orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold">No orders found</p>
                          <p className="text-sm text-muted-foreground">Try adjusting your filters or search query.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.orders.map((order) => (
                    <tr
                      key={order.id}
                      className={cn(
                        "group hover:bg-muted/30 transition-all duration-200 cursor-pointer",
                        selectedOrders.some(o => o.id === order.id) && "bg-primary/5 hover:bg-primary/5"
                      )}
                      onClick={() => {
                        if (selectedOrders.some(o => o.id === order.id)) {
                          setSelectedOrders(selectedOrders.filter(o => o.id !== order.id))
                        } else {
                          setSelectedOrders([...selectedOrders, order])
                        }
                      }}
                    >
                      <td className="py-5 px-6" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          className="rounded-[4px]"
                          checked={selectedOrders.some(o => o.id === order.id)}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedOrders([...selectedOrders, order])
                            else setSelectedOrders(selectedOrders.filter(o => o.id !== order.id))
                          }}
                        />
                      </td>
                      <td className="py-5 px-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-bold text-primary mb-1">{order.trackingNumber}</span>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                            <Calendar className="h-3 w-3" />
                            {new Date(order.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-4">
                        <div className="space-y-1">
                          <p className="text-sm font-bold leading-none">{order.customerName}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {order.customerPhone}
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-4 hidden sm:table-cell">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-wider border-none",
                            sourceConfig[order.source]?.color || 'bg-slate-100 text-slate-700'
                          )}
                        >
                          {sourceConfig[order.source]?.label || order.source}
                        </Badge>
                      </td>
                      <td className="py-5 px-4 hidden lg:table-cell">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="max-w-[180px] truncate">
                            <p className="text-sm font-medium truncate">{order.productName}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">QTY: {order.quantity}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-4 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{order.city}</span>
                        </div>
                      </td>
                      <td className="py-5 px-4 text-right">
                        <div className="inline-flex flex-col items-end">
                          <span className="text-sm font-black text-slate-900 dark:text-slate-100">{formatCurrency(order.codAmount)}</span>
                          <span className="text-[10px] font-bold text-emerald-600 uppercase">COD</span>
                        </div>
                      </td>
                      <td className="py-5 px-4 text-center">
                        <Badge 
                          variant="outline"
                          className={cn(
                            "rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-wider border-none",
                            statusConfig[order.status]?.color || 'bg-slate-100 text-slate-700'
                          )}
                        >
                          <span className={cn("mr-1.5 h-1.5 w-1.5 rounded-full", statusConfig[order.status]?.dot || 'bg-slate-500')} />
                          {statusConfig[order.status]?.label || order.status}
                        </Badge>
                      </td>
                      <td className="py-5 px-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 border-none shadow-xl rounded-xl p-1">
                            <DropdownMenuItem 
                              className="rounded-lg py-2.5 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/orders/${order.id}`)
                              }}
                            >
                              <Eye className="mr-3 h-4 w-4 text-primary" />
                              View Shipment
                            </DropdownMenuItem>
                            {user.role === 'ADMIN' && (
                              <>
                                <DropdownMenuSeparator className="my-1 bg-muted/50" />
                                <DropdownMenuItem
                                  className="text-rose-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg py-2.5 cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteOrder(order.id)
                                  }}
                                >
                                  <Trash className="mr-3 h-4 w-4" />
                                  Remove Order
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {data.pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-6 border-t bg-muted/5 gap-4">
              <p className="text-sm font-medium text-muted-foreground">
                Displaying <span className="text-foreground">{(page - 1) * data.pagination.limit + 1}</span> - <span className="text-foreground">{Math.min(page * data.pagination.limit, data.pagination.total)}</span> of <span className="text-foreground font-bold">{data.pagination.total}</span> shipments
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  className="h-9 px-4 rounded-xl border-muted/50 transition-all hover:bg-background"
                  onClick={() => {
                    const params = new URLSearchParams()
                    params.set('page', (page - 1).toString())
                    if (statusFilter !== 'ALL') params.set('status', statusFilter)
                    if (searchQuery) params.set('search', searchQuery)
                    router.push(`/orders?${params.toString()}`)
                  }}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-1 px-4">
                  <span className="text-sm font-bold text-primary">{page}</span>
                  <span className="text-xs text-muted-foreground mx-1">/</span>
                  <span className="text-sm font-medium text-muted-foreground">{data.pagination.totalPages}</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === data.pagination.totalPages}
                  className="h-9 px-4 rounded-xl border-muted/50 transition-all hover:bg-background"
                  onClick={() => {
                    const params = new URLSearchParams()
                    params.set('page', (page + 1).toString())
                    if (statusFilter !== 'ALL') params.set('status', statusFilter)
                    if (searchQuery) params.set('search', searchQuery)
                    router.push(`/orders?${params.toString()}`)
                  }}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Pro Tip/Bottom Action Card */}
        <div className="bg-primary/5 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between border border-primary/10 gap-4">
           <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                 <DollarSign className="h-6 w-6" />
              </div>
              <div>
                 <p className="font-bold text-slate-900 dark:text-slate-100">Quickly calculate profits?</p>
                 <p className="text-sm text-slate-500">Go to the Analytics dashboard for deep financial insights on these orders.</p>
              </div>
           </div>
           <Button variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10 font-bold group" onClick={() => router.push('/analytics')}>
              View Analytics
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
           </Button>
        </div>
      </div>
  )
}

// Main wrapper with Suspense boundary
export default function OrdersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrdersPageContent />
    </Suspense>
  )
}
