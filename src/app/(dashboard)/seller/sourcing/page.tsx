'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card'
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
  RefreshCw,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  ShoppingCart,
  BarChart3,
  Info,
  ArrowUpRight,
  SearchIcon,
  ShoppingBag,
  Truck,
  Box
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SourcingRequest {
  id: string
  productName: string
  description: string | null
  referenceUrl: string | null
  images: string[]
  quantity: number
  country: string
  shippingMethod: string
  trackingDetails: string | null
  type: string
  status: 'SUBMITTED' | 'IN_TRANSIT' | 'RECEIVED' | 'STOCKED' | 'REJECTED'
  adminNote: string | null
  receivedQty: number | null
  receivedImages: string[]
  damagedQty: number | null
  createdAt: string
}

const STATUS_CONFIG = {
  SUBMITTED: {
    label: 'Submitted',
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    icon: Clock,
  },
  IN_TRANSIT: {
    label: 'In Transit',
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    icon: Truck,
  },
  RECEIVED: {
    label: 'Received',
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    icon: CheckCircle2,
  },
  STOCKED: {
    label: 'Stocked',
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    icon: Box,
  },
  REJECTED: {
    label: 'Rejected',
    color: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    icon: XCircle,
  },
}

export default function SellerSourcingPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [requests, setRequests] = useState<SourcingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    productName: '',
    description: '',
    referenceUrl: '',
    quantity: '',
    country: '',
    shippingMethod: '',
  })

  useEffect(() => {
    if (userLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    fetchRequests()
  }, [user, userLoading, router])

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sourcing')
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests || [])
      }
    } catch (error) {
      toast.error('Failed to load sourcing requests')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/sourcing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success('Sourcing request submitted successfully')
        setIsDialogOpen(false)
        setFormData({ productName: '', description: '', referenceUrl: '', quantity: '', country: '', shippingMethod: '' })
        fetchRequests()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to submit request')
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (userLoading || !user) return null

  const stats = {
    total: requests.length,
    submitted: requests.filter((r) => r.status === 'SUBMITTED').length,
    inTransit: requests.filter((r) => r.status === 'IN_TRANSIT').length,
    received: requests.filter((r) => r.status === 'RECEIVED').length,
    stocked: requests.filter((r) => r.status === 'STOCKED').length,
  }

  const filteredRequests = requests.filter((r) =>
    r.productName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div className="max-w-[1200px] mx-auto space-y-8 animate-in fade-in duration-500">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Product Sourcing
            </h1>
            <p className="text-muted-foreground text-lg">
              Can't find a product in our catalog? Let us source it for you.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={fetchRequests}
              className={cn("rounded-full h-10 w-10 transition-all hover:rotate-180", loading && "animate-spin")}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-11 px-6 bg-primary hover:bg-primary/90 rounded-full shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <Plus className="mr-2 h-5 w-5" />
                  New Sourcing Request
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] border-none shadow-2xl rounded-2xl overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
                <form onSubmit={handleSubmit}>
                  <DialogHeader className="pt-4 px-6 pb-2">
                    <DialogTitle className="text-2xl font-bold">Request a Product</DialogTitle>
                    <DialogDescription className="text-base">
                      Provide as much detail as possible to help our team find the best source.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-6 py-6 px-6">
                    <div className="space-y-2">
                      <Label htmlFor="productName" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
                        Product Name *
                      </Label>
                      <Input
                        id="productName"
                        value={formData.productName}
                        onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                        placeholder="e.g. Wireless Noise Cancelling Headphones"
                        className="h-11 border-muted-foreground/20 focus-visible:ring-primary/30"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quantity" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
                          Est. Monthly Qty
                        </Label>
                        <Input
                          id="quantity"
                          type="number"
                          value={formData.quantity}
                          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                          placeholder="e.g. 100"
                          className="h-11 border-muted-foreground/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="referenceUrl" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
                          Reference Link
                        </Label>
                        <Input
                          id="referenceUrl"
                          value={formData.referenceUrl}
                          onChange={(e) => setFormData({ ...formData, referenceUrl: e.target.value })}
                          placeholder="Amazon, Alibaba, etc."
                          className="h-11 border-muted-foreground/20"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="country" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
                          Country of Origin *
                        </Label>
                        <select
                          id="country"
                          value={formData.country}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                          className="flex h-11 w-full rounded-md border border-muted-foreground/20 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          required
                        >
                          <option value="">Select country...</option>
                          <option value="China">China</option>
                          <option value="Turkey">Turkey</option>
                          <option value="USA">USA</option>
                          <option value="France">France</option>
                          <option value="Germany">Germany</option>
                          <option value="Italy">Italy</option>
                          <option value="UK">UK</option>
                          <option value="Dubai">Dubai</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shippingMethod" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
                          Shipping Method *
                        </Label>
                        <select
                          id="shippingMethod"
                          value={formData.shippingMethod}
                          onChange={(e) => setFormData({ ...formData, shippingMethod: e.target.value })}
                          className="flex h-11 w-full rounded-md border border-muted-foreground/20 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          required
                        >
                          <option value="">Select method...</option>
                          <option value="Air Freight">Air Freight</option>
                          <option value="Sea Freight">Sea Freight</option>
                          <option value="Land Transport">Land Transport</option>
                          <option value="Express Courier">Express Courier</option>
                          <option value="Local Pickup">Local Pickup</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
                        Detailed Description / Requirements
                      </Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Specify colors, sizes, or special features..."
                        className="min-h-[120px] border-muted-foreground/20 resize-none"
                      />
                    </div>
                  </div>
                  <DialogFooter className="bg-muted/30 px-6 py-4 flex flex-row items-center justify-end gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsDialogOpen(false)}
                      className="rounded-full h-11 px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-full h-11 px-8 min-w-[140px]"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        'Submit Request'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: stats.total, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Submitted', value: stats.submitted, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'In Transit', value: stats.inTransit, icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Received', value: stats.received, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Stocked', value: stats.stocked, icon: Box, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map((stat, i) => (
            <Card key={i} className="border-none shadow-sm bg-background/50 backdrop-blur-sm group hover:shadow-md transition-all duration-300">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110 duration-300", stat.bg)}>
                  <stat.icon className={cn("h-6 w-6", stat.color)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search & List Section */}
        <Card className="border-none shadow-lg overflow-hidden bg-card/40 backdrop-blur-md">
          <CardHeader className="bg-muted/20 pb-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl">Request History</CardTitle>
                <CardDescription>Track the status of your sourcing requests</CardDescription>
              </div>
              <div className="relative w-full sm:w-[300px]">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by product name..."
                  className="pl-9 h-10 bg-background/50 border-muted-foreground/20 rounded-full"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-muted-foreground animate-pulse">Fetching your requests...</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center px-6">
                <div className="h-20 w-20 bg-muted/30 rounded-full flex items-center justify-center mb-6">
                  <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No requests found</h3>
                <p className="text-muted-foreground max-w-[350px] mb-8">
                  {search 
                    ? `No matches found for "${search}". Try a different term.`
                    : "You haven't submitted any sourcing requests yet. Start by clicking 'New Sourcing Request'."
                  }
                </p>
                {!search && (
                  <Button variant="outline" onClick={() => setIsDialogOpen(true)} className="rounded-full">
                    Start Your First Request
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableHead className="w-[120px] font-bold uppercase text-[10px] tracking-widest pl-6 py-4">Submitted</TableHead>
                      <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Product Details</TableHead>
                      <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Quantity</TableHead>
                      <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Status</TableHead>
                      <TableHead className="font-bold uppercase text-[10px] tracking-widest pr-6 py-4 text-right">Feedback</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((req) => {
                      const StatusIcon = STATUS_CONFIG[req.status]?.icon || Info
                      return (
                        <TableRow key={req.id} className="group hover:bg-muted/20 transition-colors border-muted/20">
                          <TableCell className="pl-6 font-medium text-muted-foreground">
                            {new Date(req.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-base group-hover:text-primary transition-colors">
                                {req.productName}
                              </span>
                              <div className="flex items-center gap-3">
                                {req.referenceUrl && (
                                  <a
                                    href={req.referenceUrl.startsWith('http') ? req.referenceUrl : `https://${req.referenceUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary font-medium flex items-center gap-1 hover:underline underline-offset-4"
                                  >
                                    Reference <ArrowUpRight className="h-3 w-3" />
                                  </a>
                                )}
                                {req.description && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Info className="h-3 w-3" />
                                    <span>Details provided</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-lg">
                            {req.quantity || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "px-3 py-1 rounded-full font-semibold border text-[11px] uppercase tracking-wider",
                              STATUS_CONFIG[req.status]?.color || "bg-muted text-muted-foreground"
                            )}>
                              <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
                              {STATUS_CONFIG[req.status]?.label || req.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            {req.adminNote ? (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-9 px-4 rounded-full text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                    View Note
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="border-none shadow-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Admin Feedback</DialogTitle>
                                    <DialogDescription>
                                      Response regarding your request for <strong>{req.productName}</strong>
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="p-4 bg-muted/40 rounded-xl mt-4 italic text-foreground/80 leading-relaxed">
                                    "{req.adminNote}"
                                  </div>
                                </DialogContent>
                              </Dialog>
                            ) : (
                              <span className="text-sm text-muted-foreground/60 italic">No feedback yet</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Footer */}
        <div className="p-8 rounded-3xl bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent border border-primary/10">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Info className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-xl font-bold">How Sourcing Works</h3>
              <p className="text-muted-foreground leading-relaxed max-w-[800px]">
                Our team monitors all requests and contacts global suppliers to find the best quality and price for your needs. 
                Approved products will be added to our shared catalog with a special 
                <span className="font-semibold text-foreground mx-1">Pre-Order</span> status or reserved stock for you.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
