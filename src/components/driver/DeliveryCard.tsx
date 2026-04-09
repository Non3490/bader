'use client'

/**
 * DeliveryCard Component
 * Compact delivery info card for lists
 */

import { MapPin, Phone, DollarSign } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DeliveryCardProps {
  id: string
  status: string
  trackingNumber: string
  recipientName: string
  address: string
  city: string
  phone: string
  codAmount: number
  onPress?: () => void
}

export function DeliveryCard({
  id,
  status,
  trackingNumber,
  recipientName,
  address,
  city,
  phone,
  codAmount,
  onPress
}: DeliveryCardProps) {
  const router = useRouter()

  const getStatusColor = () => {
    switch (status) {
      case 'ASSIGNED': return 'bg-blue-500'
      case 'PICKED_UP': return 'bg-yellow-500'
      case 'IN_TRANSIT': return 'bg-purple-500'
      case 'DELIVERED': return 'bg-green-500'
      case 'RETURNED': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusLabel = () => {
    switch (status) {
      case 'ASSIGNED': return 'Assigned'
      case 'PICKED_UP': return 'Picked Up'
      case 'IN_TRANSIT': return 'In Transit'
      case 'DELIVERED': return 'Delivered'
      case 'RETURNED': return 'Returned'
      default: return status
    }
  }

  const handlePress = () => {
    if (onPress) {
      onPress()
    } else {
      router.push(`/driver/deliveries/${id}`)
    }
  }

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.location.href = `tel:${phone}`
  }

  return (
    <button
      onClick={handlePress}
      className="w-full bg-slate-800 rounded-xl p-4 border border-slate-700 text-left hover:border-slate-600 transition-all active:scale-98"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor()}`}>
          {getStatusLabel()}
        </span>
        <span className="text-slate-500 text-xs">
          #{trackingNumber.slice(-6)}
        </span>
      </div>

      {/* Customer */}
      <h3 className="font-semibold text-white mb-1">
        {recipientName}
      </h3>

      {/* Address */}
      <div className="flex items-start gap-2 text-slate-400 text-sm mb-3">
        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span className="line-clamp-2">{address}, {city}</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1 text-green-400 font-semibold">
          <DollarSign className="w-4 h-4" />
          {codAmount.toLocaleString()} XAF
        </div>

        <button
          onClick={handleCall}
          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
        >
          <Phone className="w-4 h-4" />
          Call
        </button>
      </div>
    </button>
  )
}
