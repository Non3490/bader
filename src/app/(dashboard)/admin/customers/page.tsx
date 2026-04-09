'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PermissionGate } from '@/components/admin/PermissionGate'
import { useAdminSession } from '@/hooks/use-admin-session'
import {
  Search,
  Filter,
  Download,
  Ban,
  ShieldCheck,
  MoreHorizontal,
  Phone,
  ShoppingCart,
  DollarSign,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { format } from 'date-fns'

interface Customer {
  id: string
  phone: string
  deliveryRate: number
  orderCount: number
  deliveredCount: number
  updatedAt: Date
  isBlocked: boolean
  isVip: boolean
  totalSpent: number
  recentOrders: Array<{
    id: string
    status: string
    codAmount: number
    createdAt: Date
  }>
}

export default function AdminCustomersPage() {
  const { session } = useAdminSession()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [blockReason, setBlockReason] = useState('')

  useEffect(() => {
    fetchCustomers()
  }, [page, statusFilter])

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter })
      })

      const response = await fetch(`/api/admin/customers?${params}`)
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    fetchCustomers()
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        export: 'true',
        ...(statusFilter !== 'all' && { status: statusFilter })
      })

      const response = await fetch(`/api/admin/customers?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `customers-${Date.now()}.csv`
        a.click()
      }
    } catch (error) {
      console.error('Failed to export customers:', error)
    }
  }

  const handleBlockCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer)
    setBlockReason(customer.isBlocked ? '' : 'Manual block by admin')
    setDialogOpen(true)
  }

  const confirmBlock = async () => {
    if (!selectedCustomer) return

    try {
      const response = await fetch(`/api/admin/customers/${encodeURIComponent(selectedCustomer.phone)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isBlocked: !selectedCustomer.isBlocked,
          blockReason: blockReason
        })
      })

      if (response.ok) {
        fetchCustomers()
        setDialogOpen(false)
        setSelectedCustomer(null)
      }
    } catch (error) {
      console.error('Failed to update customer:', error)
    }
  }

  const getStatusBadge = (customer: Customer) => {
    if (customer.isBlocked) {
      return <Badge variant="destructive">Blocked</Badge>
    }
    if (customer.isVip) {
      return <Badge variant="default" className="bg-yellow-500">VIP</Badge>
    }
    return <Badge variant="secondary">Active</Badge>
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Management</h1>
          <p className="text-muted-foreground">
            Manage customers, view order history, and handle VIP/Blocked status
          </p>
        </div>
        <PermissionGate permission="data:export">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </PermissionGate>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">VIP Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {customers.filter(c => c.isVip).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {customers.filter(c => c.isBlocked).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customers.reduce((sum, c) => sum + c.totalSpent, 0).toLocaleString()} FCFA
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by phone number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="vip">VIP Only</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>
            Showing {customers.length} of {total} customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {customer.phone}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(customer)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                          {customer.orderCount}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          {customer.deliveredCount}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          {customer.totalSpent.toLocaleString()} FCFA
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(customer.updatedAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <PermissionGate permission="customers:manage">
                          <Button
                            variant={customer.isBlocked ? "outline" : "destructive"}
                            size="sm"
                            onClick={() => handleBlockCustomer(customer)}
                          >
                            {customer.isBlocked ? (
                              <>
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Unblock
                              </>
                            ) : (
                              <>
                                <Ban className="h-4 w-4 mr-2" />
                                Block
                              </>
                            )}
                          </Button>
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of {total}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * 50 >= total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block/Unblock Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer?.isBlocked ? 'Unblock Customer' : 'Block Customer'}
            </DialogTitle>
            <DialogDescription>
              {selectedCustomer?.isBlocked
                ? 'Are you sure you want to unblock this customer? They will be able to place orders again.'
                : 'Are you sure you want to block this customer? They will not be able to place orders.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{selectedCustomer?.phone}</span>
            </div>
            {!selectedCustomer?.isBlocked && (
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for blocking</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for blocking this customer..."
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={selectedCustomer?.isBlocked ? "default" : "destructive"}
              onClick={confirmBlock}
            >
              {selectedCustomer?.isBlocked ? 'Unblock' : 'Block'} Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
