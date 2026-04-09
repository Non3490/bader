'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Lock, CheckCircle, AlertTriangle, User } from 'lucide-react'

interface DeliveryMan {
  id: string
  name: string
  phone: string | null
  _count: { deliveredOrders: number }
}

interface RemittanceSummary {
  deliveryManId: string
  deliveryManName: string
  totalOrdersToday: number
  totalCashCollected: number
  cashOnHand: number
}

const today = new Date().toISOString().split('T')[0]

export default function RemittancePage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [summaries, setSummaries] = useState<RemittanceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [locking, setLocking] = useState<Record<string, boolean>>({})

  // Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    deliveryManId: string | null
    deliveryManName: string
    cashAmount: number
  }>({ open: false, deliveryManId: null, deliveryManName: '', cashAmount: 0 })

  useEffect(() => {
    if (userLoading) return
    if (!user) { router.push('/login'); return }
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') { router.push('/unauthorized'); return }
    loadRemittanceSummary()
  }, [user, userLoading, router])

  const loadRemittanceSummary = async () => {
    try {
      const res = await fetch(`/api/finance/remittance?date=${today}`)
      const data = await res.json()
      setSummaries(data.summaries ?? [])
    } catch (error) {
      toast.error('Failed to load remittance data')
    } finally {
      setLoading(false)
    }
  }

  const handleLock = async (deliveryManId: string, deliveryManName: string, cashAmount: number) => {
    setConfirmDialog({
      open: false,
      deliveryManId: null,
      deliveryManName: '',
      cashAmount: 0
    })
    setLocking({ ...locking, [deliveryManId]: true })

    try {
      const res = await fetch('/api/finance/remittance/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryManId,
          dateFrom: `${today}T00:00:00Z`,
          dateTo: `${today}T23:59:59Z`,
          cashCollected: cashAmount
        })
      })

      if (!res.ok) throw new Error('Failed to lock remittance')

      toast.success('Remittance locked successfully')
      await loadRemittanceSummary()
    } catch (error) {
      toast.error('Failed to lock remittance')
    } finally {
      setLocking(d => ({ ...d, [deliveryManId]: false }))
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-GA', { style: 'currency', currency: 'XAF' }).format(value)

  if (userLoading || !user) return null

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Lock className="h-6 w-6" />Daily Remittance</h1>
          <p className="text-muted-foreground">Lock and reconcile daily cash collections from delivery men</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : summaries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No remittance data for today.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {summaries.map(summary => (
              <Card key={summary.deliveryManId}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {summary.deliveryManName}
                  </CardTitle>
                  <CardDescription>
                    Orders delivered today: {summary.totalOrdersToday}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Total Cash Collected</Label>
                      <div className="text-2xl font-bold">{formatCurrency(summary.totalCashCollected)}</div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Cash On Hand</Label>
                      <div className="text-2xl font-bold">{formatCurrency(summary.cashOnHand)}</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Reconciled status for {today}
                      </span>
                      {summary.isLocked ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1 inline" />
                          Reconciled
                        </Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-800">
                          <AlertTriangle className="h-3 w-3 mr-1 inline" />
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>

                  {!summary.isLocked && (
                    <Button
                      className="w-full"
                      onClick={() => setConfirmDialog({
                        open: true,
                        deliveryManId: summary.deliveryManId,
                        deliveryManName: summary.deliveryManName,
                        cashAmount: summary.cashOnHand
                      })}
                      disabled={locking[summary.deliveryManId]}
                    >
                      {locking[summary.deliveryManId] ? 'Locking...' : <><Lock className="h-4 w-4 mr-2" />Lock & Reconcile</>}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={open => setConfirmDialog(d => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Lock & Reconcile</DialogTitle>
            <DialogDescription>
              This will lock today's remittance period for <strong>{confirmDialog.deliveryManName}</strong>.
              The collected cash will be recorded and the period will be marked as reconciled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Delivery Man</Label>
              <div className="font-medium">{confirmDialog.deliveryManName}</div>
            </div>
            <div className="space-y-2">
              <Label>Date Period</Label>
              <div className="text-sm text-muted-foreground">{today}</div>
            </div>
            <div className="space-y-2">
              <Label>Cash Collected (XAF)</Label>
              <Input
                type="number"
                value={confirmDialog.cashAmount}
                onChange={e => setConfirmDialog({ ...confirmDialog, cashAmount: parseFloat(e.target.value) || 0 })}
                className="text-2xl font-bold"
              />
            </div>
            <div className="text-sm text-muted-foreground bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
              Make sure to count the physical cash before locking. This action cannot be undone.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmDialog.deliveryManId && handleLock(confirmDialog.deliveryManId, confirmDialog.deliveryManName, confirmDialog.cashAmount)}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirm Lock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
