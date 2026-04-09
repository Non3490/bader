'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@/hooks/use-user'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Package, Search, AlertTriangle, AlertCircle, Edit2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DailyReport } from '@/components/inventory/DailyReport'

interface StockItem {
  id: string
  product: { id: string; name: string; sku: string; sellPrice: number }
  warehouse: string
  quantity: number
  alertLevel: number
  updatedAt: string
}

export default function SellerStockPage() {
  const { user, loading: userLoading } = useUser()
  const router = useRouter()
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Modal state
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateData, setUpdateData] = useState({
    quantity: '',
    alertLevel: '',
    note: ''
  })

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    } else if (user?.role !== 'SELLER') {
      router.push('/dashboard')
    }
  }, [user, userLoading, router])

  const fetchStocks = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/stock')
      const data = await res.json()
      if (res.ok) {
        setStocks(data.stocks || [])
      } else {
        toast.error('Failed to load stock data')
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'SELLER') {
      fetchStocks()
    }
  }, [user, fetchStocks])

  const handleOpenModal = (stock: StockItem) => {
    setSelectedStock(stock)
    setUpdateData({
      quantity: String(stock.quantity),
      alertLevel: String(stock.alertLevel),
      note: ''
    })
  }

  const handleUpdate = async () => {
    if (!selectedStock) return
    setIsUpdating(true)
    try {
      const res = await fetch('/api/stock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedStock.id,
          quantity: updateData.quantity,
          alertLevel: updateData.alertLevel,
          note: updateData.note
        })
      })

      if (res.ok) {
        toast.success('Stock updated successfully')
        setSelectedStock(null)
        fetchStocks()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update stock')
      }
    } catch (error) {
      toast.error('Network error')
    } finally {
      setIsUpdating(false)
    }
  }

  const filteredStocks = stocks.filter(s => 
    s.product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const lowStockCount = stocks.filter(s => s.quantity <= s.alertLevel).length
  const outOfStockCount = stocks.filter(s => s.quantity === 0).length

  if (userLoading || loading && stocks.length === 0) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <Tabs defaultValue="inventory" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" /> Inventory Management
          </h1>
          <p className="text-muted-foreground text-sm">Monitor stock levels, set alerts, and manage warehouse availability.</p>
        </div>
        <TabsList>
          <TabsTrigger value="inventory">Live Inventory</TabsTrigger>
          <TabsTrigger value="daily-report">Daily Report</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="inventory" className="space-y-6 mt-0">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-50 dark:bg-slate-900/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{stocks.length}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-500">Low Stock Alerts</p>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{lowStockCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-500">Out of Stock</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{outOfStockCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-lg border shadow-sm dark:bg-slate-950">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by product name or SKU..." 
            className="pl-8"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-sm font-medium text-muted-foreground">
          Showing {filteredStocks.length} of {stocks.length} products
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead className="text-right">Available QTY</TableHead>
              <TableHead className="text-right">Alert Level</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStocks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No products found. Add products to catalog to manage stock.
                </TableCell>
              </TableRow>
            ) : (
              filteredStocks.map(stock => {
                const isLow = stock.quantity <= stock.alertLevel
                const isOut = stock.quantity === 0
                return (
                  <TableRow key={stock.id} className={isOut ? "bg-red-50/50 dark:bg-red-950/20" : isLow ? "bg-yellow-50/50 dark:bg-yellow-950/20" : ""}>
                    <TableCell className="font-medium">
                      {stock.product.name}
                      {isOut ? (
                        <Badge variant="destructive" className="ml-2 text-[10px] uppercase">Out of Stock</Badge>
                      ) : isLow ? (
                        <Badge variant="outline" className="ml-2 text-[10px] uppercase bg-yellow-100 text-yellow-800 border-yellow-300">Low Stock</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{stock.product.sku}</TableCell>
                    <TableCell>{stock.warehouse}</TableCell>
                    <TableCell className="text-right font-bold text-lg">{stock.quantity}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{stock.alertLevel}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenModal(stock)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Adjust
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Adjust Modal */}
      <Dialog open={!!selectedStock} onOpenChange={(open) => !open && setSelectedStock(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock Level</DialogTitle>
            <DialogDescription>
              Update inventory quantity and alert threshold for {selectedStock?.product.name}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Actual Quantity</label>
                <Input 
                  type="number"
                  min="0"
                  value={updateData.quantity}
                  onChange={e => setUpdateData(prev => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Low Stock Alert Level</label>
                <Input 
                  type="number"
                  min="0"
                  value={updateData.alertLevel}
                  onChange={e => setUpdateData(prev => ({ ...prev, alertLevel: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Adjustment Reason (Optional)</label>
              <Input 
                placeholder="e.g. Audit correction, found in warehouse..."
                value={updateData.note}
                onChange={e => setUpdateData(prev => ({ ...prev, note: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedStock(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </TabsContent>

      <TabsContent value="daily-report" className="mt-0">
        <DailyReport />
      </TabsContent>
    </Tabs>
  )
}
