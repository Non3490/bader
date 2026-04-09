'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Percent,
  Loader2,
  Shield,
  DollarSign,
} from 'lucide-react'

interface DiscountApplyProps {
  orderId: string
  currentCodAmount: number
  onSuccess?: () => void
  className?: string
}

interface DiscountReason {
  value: string
  label: string
  requiresManager?: boolean
}

const DISCOUNT_REASONS: DiscountReason[] = [
  { value: 'LATE_DELIVERY', label: 'Late Delivery' },
  { value: 'WRONG_ITEM', label: 'Wrong Item Delivered' },
  { value: 'COMPLAINT_RESOLUTION', label: 'Complaint Resolution' },
  { value: 'LOYALTY', label: 'Customer Loyalty' },
  { value: 'MANAGER_OVERRIDE', label: 'Manager Override', requiresManager: true },
  { value: 'OTHER', label: 'Other Reason' },
]

function formatMoney(value: number) {
  return new Intl.NumberFormat('fr-GA', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(value)
}

export function DiscountApply({
  orderId,
  currentCodAmount,
  onSuccess,
  className
}: DiscountApplyProps) {
  const [discountAmount, setDiscountAmount] = useState('')
  const [reason, setReason] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [userRole, setUserRole] = useState<string>('')
  const [applying, setApplying] = useState(false)

  // Fetch available discount reasons
  useEffect(() => {
    const fetchDiscountReasons = async () => {
      try {
        const res = await fetch('/api/discounts/apply')
        if (res.ok) {
          // User info would come from session, this is placeholder
          // In real app, you'd get user role from session
        }
      } catch (error) {
        console.error('Failed to fetch discount reasons:', error)
      }
    }
    fetchDiscountReasons()
  }, [])

  const calculateNewTotal = () => {
    const discount = parseInt(discountAmount) || 0
    return Math.max(0, currentCodAmount - discount)
  }

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault()

    const discount = parseInt(discountAmount)
    if (isNaN(discount) || discount <= 0) {
      toast.error('Please enter a valid discount amount')
      return
    }

    if (!reason) {
      toast.error('Please select a reason for the discount')
      return
    }

    if (discount > currentCodAmount) {
      toast.error('Discount cannot exceed order amount')
      return
    }

    // Check for manager override
    if (reason === 'MANAGER_OVERRIDE' && userRole !== 'ADMIN') {
      toast.error('Manager Override requires Manager or Admin role')
      return
    }

    setApplying(true)
    try {
      const res = await fetch('/api/discounts/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          discountAmount: discount,
          reason,
          notes: notes || undefined
        })
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`Discount applied: ${formatMoney(discount)}`)
        // Reset form
        setDiscountAmount('')
        setReason('')
        setNotes('')
        onSuccess?.()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to apply discount')
      }
    } catch (error) {
      console.error('Apply discount error:', error)
      toast.error('Failed to apply discount')
    } finally {
      setApplying(false)
    }
  }

  const selectedReason = DISCOUNT_REASONS.find(r => r.value === reason)
  const requiresManager = selectedReason?.requiresManager

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Apply Discount
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleApply} className="space-y-4">
          {/* Current Amount Display */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current COD Amount</span>
              <span className="font-bold">{formatMoney(currentCodAmount)}</span>
            </div>
          </div>

          {/* Discount Amount */}
          <div className="space-y-2">
            <Label htmlFor="discountAmount" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Discount Amount (FCFA) *
            </Label>
            <Input
              id="discountAmount"
              type="number"
              min="1"
              max={currentCodAmount}
              placeholder="Enter discount amount"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
            />
            {discountAmount && (
              <p className="text-xs text-muted-foreground">
                New total: {formatMoney(calculateNewTotal())}
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {DISCOUNT_REASONS.map(r => (
                  <SelectItem
                    key={r.value}
                    value={r.value}
                    disabled={r.requiresManager && userRole !== 'ADMIN'}
                  >
                    <div className="flex items-center gap-2">
                      {r.requiresManager && <Shield className="h-3 w-3 text-amber-500" />}
                      <span>{r.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {requiresManager && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Requires Manager or Admin role
              </p>
            )}
          </div>

          {/* Notes (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Input
              id="notes"
              placeholder="Add context about this discount..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground text-right">
              {notes.length}/200
            </p>
          </div>

          {/* Audit Notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800">
              <strong>Note:</strong> All discounts are logged for audit purposes. Please ensure you have customer approval before applying.
            </p>
          </div>

          {/* Apply Button */}
          <Button
            type="submit"
            disabled={applying || !discountAmount || !reason}
            className="w-full"
            variant={reason === 'MANAGER_OVERRIDE' ? 'default' : 'secondary'}
          >
            {applying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Percent className="h-4 w-4 mr-2" />
                Apply Discount
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
