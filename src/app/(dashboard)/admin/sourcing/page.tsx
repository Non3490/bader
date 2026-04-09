'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@/hooks/use-user'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Package, Search, ExternalLink, Activity } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface SourcingReq {
  id: string
  seller: { name: string; phone: string | null }
  productName: string
  quantity: number
  country: string
  shippingMethod: string
  type: string
  status: string
  createdAt: string
  images: string[]
  receivedQty?: number
  damagedQty?: number
  adminNote?: string
}

const statusColors: Record<string, string> = {
  SUBMITTED: 'bg-yellow-100 text-yellow-800',
  IN_TRANSIT: 'bg-blue-100 text-blue-800',
  RECEIVED: 'bg-purple-100 text-purple-800',
  STOCKED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800'
}

export default function AdminSourcingPage() {
  const { user, loading: userLoading } = useUser()
  const router = useRouter()
  const [requests, setRequests] = useState<SourcingReq[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  
  // Modal state
  const [selectedReq, setSelectedReq] = useState<SourcingReq | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateData, setUpdateData] = useState({
    status: '',
    receivedQty: '',
    damagedQty: '0',
    adminNote: ''
  })

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    } else if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
    }
  }, [user, userLoading, router])

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/sourcing${statusFilter !== 'ALL' ? `?status=${statusFilter}` : ''}`)
      const data = await res.json()
      if (res.ok) {
        setRequests(data.requests || [])
      } else {
        toast.error('Failed to load sourcing requests')
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
      fetchRequests()
    }
  }, [user, fetchRequests])

  const handleOpenModal = (req: SourcingReq) => {
    setSelectedReq(req)
    setUpdateData({
      status: req.status,
      receivedQty: req.receivedQty ? String(req.receivedQty) : String(req.quantity),
      damagedQty: req.damagedQty ? String(req.damagedQty) : '0',
      adminNote: req.adminNote || ''
    })
  }

  const handleUpdate = async () => {
    if (!selectedReq) return
    setIsUpdating(true)
    try {
      const payload: any = {
        status: updateData.status,
        adminNote: updateData.adminNote
      }
      if (updateData.status === 'RECEIVED' || updateData.status === 'STOCKED') {
        payload.receivedQty = updateData.receivedQty
        payload.damagedQty = updateData.damagedQty
      }

      const res = await fetch(`/api/sourcing/${selectedReq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        toast.success('Request updated successfully')
        setSelectedReq(null)
        fetchRequests()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update request')
      }
    } catch (error) {
      toast.error('Network error')
    } finally {
      setIsUpdating(false)
    }
  }

  const filteredRequests = requests.filter(req => 
    req.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    req.seller.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (userLoading || loading && requests.length === 0) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" /> Sourcing Management
          </h1>
          <p className="text-muted-foreground text-sm">Review incoming inventory and update receipt statuses.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-lg border shadow-sm dark:bg-slate-950">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search product or seller..." 
              className="pl-8"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
              <SelectItem value="RECEIVED">Received</SelectItem>
              <SelectItem value="STOCKED">Stocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm font-medium text-muted-foreground">
          {requests.length} Requests Found
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Origin / Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No requests found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map(req => (
                <TableRow key={req.id}>
                  <TableCell className="whitespace-nowrap">{format(new Date(req.createdAt), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="font-medium">{req.seller.name}</TableCell>
                  <TableCell>
                    <div className="font-medium truncate max-w-[200px]" title={req.productName}>{req.productName}</div>
                    {req.images.length > 0 && <span className="text-xs text-blue-500 flex items-center gap-1 mt-1"><ExternalLink className="h-3 w-3"/> Image Attached</span>}
                  </TableCell>
                  <TableCell>{req.quantity} PCs</TableCell>
                  <TableCell>{req.country} / {req.shippingMethod}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[req.status] || ''}>
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenModal(req)}>
                      <Activity className="h-4 w-4 mr-2" />
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Action Modal */}
      <Dialog open={!!selectedReq} onOpenChange={(open) => !open && setSelectedReq(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Update Sourcing Request</DialogTitle>
            <DialogDescription>
              {selectedReq?.productName} ({selectedReq?.quantity} units expected from {selectedReq?.seller.name})
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Update Status</label>
              <Select value={updateData.status} onValueChange={val => setUpdateData(prev => ({ ...prev, status: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                  <SelectItem value="RECEIVED">Received at Warehouse</SelectItem>
                  <SelectItem value="STOCKED">Stocked (Available)</SelectItem>
                  <SelectItem value="REJECTED">Rejected / Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(updateData.status === 'RECEIVED' || updateData.status === 'STOCKED') && (
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 border rounded-md dark:bg-slate-900">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Actual Received</label>
                  <Input 
                    type="number"
                    value={updateData.receivedQty}
                    onChange={e => setUpdateData(prev => ({ ...prev, receivedQty: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Expected: {selectedReq?.quantity}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Damaged Units</label>
                  <Input 
                    type="number"
                    value={updateData.damagedQty}
                    onChange={e => setUpdateData(prev => ({ ...prev, damagedQty: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Internal Admin Note (Optional)</label>
              <Textarea 
                placeholder="Log any discrepancies or shipment issues..."
                value={updateData.adminNote}
                onChange={e => setUpdateData(prev => ({ ...prev, adminNote: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReq(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
