'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Save,
  Loader2,
  Calendar,
} from 'lucide-react'

interface CallLogFormProps {
  customerPhone: string
  orderId?: string
  onSuccess?: () => void
  className?: string
}

type CallDirection = 'INCOMING' | 'OUTGOING'
type CallType = 'ORDER' | 'INQUIRY' | 'COMPLAINT' | 'FOLLOWUP' | 'OTHER'

const directionConfig = {
  INCOMING: { label: 'Incoming', icon: PhoneIncoming, color: 'text-green-600' },
  OUTGOING: { label: 'Outgoing', icon: PhoneOutgoing, color: 'text-blue-600' },
}

const callTypeLabels: Record<CallType, string> = {
  ORDER: 'Order Related',
  INQUIRY: 'General Inquiry',
  COMPLAINT: 'Complaint',
  FOLLOWUP: 'Follow Up',
  OTHER: 'Other',
}

export function CallLogForm({
  customerPhone,
  orderId,
  onSuccess,
  className
}: CallLogFormProps) {
  const [direction, setDirection] = useState<CallDirection>('INCOMING')
  const [callType, setCallType] = useState<CallType>('ORDER')
  const [notes, setNotes] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [callbackNeeded, setCallbackNeeded] = useState(false)
  const [callbackDate, setCallbackDate] = useState('')
  const [callbackTime, setCallbackTime] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!customerPhone) {
      toast.error('Customer phone number is required')
      return
    }

    if (callbackNeeded && (!callbackDate || !callbackTime)) {
      toast.error('Please select callback date and time')
      return
    }

    setSubmitting(true)
    try {
      const callbackAt = callbackNeeded && callbackDate && callbackTime
        ? new Date(`${callbackDate}T${callbackTime}`)
        : undefined

      const res = await fetch('/api/phone-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerPhone,
          direction,
          callType,
          orderId,
          notes: notes || undefined,
          durationMinutes: durationMinutes ? parseInt(durationMinutes) : undefined,
          callbackNeeded,
          callbackAt: callbackAt?.toISOString()
        })
      })

      if (res.ok) {
        toast.success('Call logged successfully')
        // Reset form
        setNotes('')
        setDurationMinutes('')
        setCallbackNeeded(false)
        setCallbackDate('')
        setCallbackTime('')
        onSuccess?.()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to log call')
      }
    } catch (error) {
      console.error('Log call error:', error)
      toast.error('Failed to log call')
    } finally {
      setSubmitting(false)
    }
  }

  // Set minimum callback date to today
  const today = new Date().toISOString().split('T')[0]

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Log Call
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Phone Display */}
          <div className="p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Customer: </span>
            <span className="text-sm">{customerPhone}</span>
          </div>

          {/* Call Direction */}
          <div className="space-y-2">
            <Label>Call Direction *</Label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(directionConfig) as CallDirection[]).map((dir) => {
                const config = directionConfig[dir]
                const Icon = config.icon
                return (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => setDirection(dir)}
                    className={cn(
                      'flex items-center justify-center gap-2 p-3 border rounded-lg transition-colors',
                      direction === dir
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-muted'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', direction === dir ? config.color : 'text-muted-foreground')} />
                    <span className="text-sm font-medium">{config.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Call Type */}
          <div className="space-y-2">
            <Label htmlFor="callType">Call Type *</Label>
            <Select value={callType} onValueChange={(v: CallType) => setCallType(v)}>
              <SelectTrigger id="callType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(callTypeLabels) as CallType[]).map(type => (
                  <SelectItem key={type} value={type}>
                    {callTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Duration (minutes)
            </Label>
            <Input
              id="duration"
              type="number"
              min="0"
              placeholder="e.g., 5"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter the call duration manually
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Call notes, customer requests, issues discussed..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {notes.length}/500
            </p>
          </div>

          {/* Callback Section */}
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="callback"
                checked={callbackNeeded}
                onCheckedChange={(checked) => setCallbackNeeded(checked as boolean)}
              />
              <Label htmlFor="callback" className="flex items-center gap-2 cursor-pointer">
                <Calendar className="h-4 w-4" />
                Callback needed
              </Label>
            </div>

            {callbackNeeded && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="callbackDate">Date *</Label>
                  <Input
                    id="callbackDate"
                    type="date"
                    min={today}
                    value={callbackDate}
                    onChange={(e) => setCallbackDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="callbackTime">Time *</Label>
                  <Input
                    id="callbackTime"
                    type="time"
                    value={callbackTime}
                    onChange={(e) => setCallbackTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Logging...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Log Call
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
