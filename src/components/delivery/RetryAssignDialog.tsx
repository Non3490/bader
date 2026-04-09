'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { MapPin, RefreshCw } from 'lucide-react'

interface RetryAssignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orders: Array<{ id: string; trackingNumber: string; address: string; city: string }>
  onAssigned: () => void
}

export function RetryAssignDialog({ open, onOpenChange, orders, onAssigned }: RetryAssignDialogProps) {
  const [correctingOrder, setCorrectingOrder] = useState<string | null>(null)
  const [correctedAddress, setCorrectedAddress] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRetrySingle = async (orderId: string, address: string, city: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/delivery-zones/retry-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, address, city })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to assign')
      }

      const result = await res.json()
      if (result.success) {
        toast.success(`Order assigned to ${result.driverName}`)
        onAssigned()
        onOpenChange(false)
      } else {
        toast.error('Address still not found in any zone')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign')
    } finally {
      setLoading(false)
    }
  }

  const handleCorrectAddress = async () => {
    if (!correctingOrder || !correctedAddress.trim()) return

    setLoading(true)
    try {
      const order = orders.find(o => o.id === correctingOrder)
      if (!order) return

      const res = await fetch('/api/admin/delivery-zones/retry-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: correctingOrder,
          address: correctedAddress,
          city: order.city
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to assign')
      }

      const result = await res.json()
      if (result.success) {
        toast.success(`Order assigned to ${result.driverName}`)
        onAssigned()
        onOpenChange(false)
      } else {
        toast.error('Corrected address still not found in any zone')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Retry Zone Assignment</DialogTitle>
          <DialogDescription>
            These orders couldn't be auto-assigned. You can retry with the original address,
            correct the address, or manually assign them to a driver.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {orders.map(order => (
            <div key={order.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{order.trackingNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.address}, {order.city}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRetrySingle(order.id, order.address, order.city)}
                    disabled={loading}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCorrectingOrder(order.id)
                      setCorrectedAddress(order.address)
                    }}
                  >
                    <MapPin className="h-4 w-4 mr-1" />
                    Correct
                  </Button>
                </div>
              </div>

              {correctingOrder === order.id && (
                <div className="space-y-2 pt-2">
                  <Label>Correct Address:</Label>
                  <Input
                    value={correctedAddress}
                    onChange={(e) => setCorrectedAddress(e.target.value)}
                    placeholder="Enter correct address"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCorrectAddress} disabled={loading || !correctedAddress.trim()}>
                      Save & Retry
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCorrectingOrder(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
