'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileText, Plus, Loader2, Check, FileDown } from 'lucide-react'
import { toast } from 'sonner'

interface Invoice {
  id: string
  ref: string
  cashCollected: number
  refundedAmount: number
  subtotal: number
  vat: number
  totalNet: number
  status: string
  dateFrom: string
  dateTo: string
  isLocked: boolean
  createdAt: string
  seller: { id: string; name: string; email: string }
}

interface Seller {
  id: string
  name: string
  email: string
}

export default function AdminInvoicesPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [form, setForm] = useState({ sellerId: '', dateFrom: '', dateTo: '', vat: '0' })

  useEffect(() => {
    if (userLoading) return
    if (!user) { router.push('/login'); return }
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') { router.push('/unauthorized'); return }
  }, [user, userLoading, router])

  useEffect(() => {
    if (!user || user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return
    Promise.all([
      fetch('/api/invoices').then(r => r.json()),
      fetch('/api/users?role=SELLER').then(r => r.json())
    ]).then(([invData, usrData]) => {
      setInvoices(invData.invoices ?? [])
      setSellers(usrData.users ?? [])
    }).finally(() => setLoading(false))
  }, [user])

  const refreshInvoices = () =>
    fetch('/api/invoices').then(r => r.json()).then(d => setInvoices(d.invoices ?? []))

  const handleCreate = async () => {
    if (!form.sellerId || !form.dateFrom || !form.dateTo) {
      return toast.error('Seller, date from and date to are required')
    }
    setCreating(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerId: form.sellerId,
          dateFrom: form.dateFrom,
          dateTo: form.dateTo,
          vat: parseFloat(form.vat) || 0
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success(`Invoice ${data.invoice.ref} created`)
      setShowCreate(false)
      setForm({ sellerId: '', dateFrom: '', dateTo: '', vat: '0' })
      await refreshInvoices()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setCreating(false)
    }
  }

  const handleMarkPaid = async (inv: Invoice) => {
    setUpdatingId(inv.id)
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: inv.status === 'PAID' ? 'UNPAID' : 'PAID' })
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(inv.status === 'PAID' ? 'Marked as unpaid' : 'Marked as paid')
      await refreshInvoices()
    } catch {
      toast.error('Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat('fr-GA', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(v)

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-GA')

  if (userLoading || !user) return null

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />Invoices Management
            </h1>
            <p className="text-muted-foreground">COD settlement invoices for all sellers</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />New Invoice
          </Button>
        </div>

        <Card>
          <CardHeader><CardTitle>All Invoices</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p>No invoices yet. Create one for a seller.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-3 px-2">Ref</th>
                      <th className="text-left py-3 px-2">Seller</th>
                      <th className="text-left py-3 px-2 hidden md:table-cell">Period</th>
                      <th className="text-right py-3 px-2 hidden md:table-cell">Collected</th>
                      <th className="text-right py-3 px-2 hidden md:table-cell">Returned</th>
                      <th className="text-right py-3 px-2">Net</th>
                      <th className="text-center py-3 px-2">Status</th>
                      <th className="text-center py-3 px-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2 font-mono">{inv.ref}</td>
                        <td className="py-3 px-2">
                          <div className="font-medium">{inv.seller.name}</div>
                          <div className="text-xs text-muted-foreground">{inv.seller.email}</div>
                        </td>
                        <td className="py-3 px-2 hidden md:table-cell text-xs text-muted-foreground">
                          {fmtDate(inv.dateFrom)} — {fmtDate(inv.dateTo)}
                        </td>
                        <td className="py-3 px-2 text-right hidden md:table-cell">{fmt(inv.cashCollected)}</td>
                        <td className="py-3 px-2 text-right hidden md:table-cell text-red-600">
                          -{fmt(inv.refundedAmount)}
                        </td>
                        <td className="py-3 px-2 text-right font-bold">{fmt(inv.totalNet)}</td>
                        <td className="py-3 px-2 text-center">
                          <Badge className={inv.status === 'PAID'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-orange-100 text-orange-800'
                          }>{inv.status}</Badge>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`/api/invoices/${inv.id}/pdf`, '_blank')}
                              title="Download PDF"
                            >
                              <FileDown className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={inv.isLocked || updatingId === inv.id}
                              onClick={() => handleMarkPaid(inv)}
                            >
                              {updatingId === inv.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : inv.status === 'PAID'
                                  ? 'Unmark'
                                  : <><Check className="h-3 w-3 mr-1" />Paid</>
                              }
                            </Button>
                          </div>
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

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Seller *</Label>
              <Select value={form.sellerId} onValueChange={v => setForm(f => ({ ...f, sellerId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select seller..." />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date From *</Label>
                <Input
                  type="date"
                  value={form.dateFrom}
                  onChange={e => setForm(f => ({ ...f, dateFrom: e.target.value }))}
                />
              </div>
              <div>
                <Label>Date To *</Label>
                <Input
                  type="date"
                  value={form.dateTo}
                  onChange={e => setForm(f => ({ ...f, dateTo: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>VAT % (optional)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                placeholder="0"
                value={form.vat}
                onChange={e => setForm(f => ({ ...f, vat: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The invoice will automatically calculate total collected cash from DELIVERED orders
              minus returns in the selected period.
            </p>
            <Button className="w-full" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {creating ? 'Creating...' : 'Create Invoice'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
