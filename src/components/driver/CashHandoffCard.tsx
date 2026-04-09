'use client'

/**
 * CashHandoffCard Component
 * Displays cash collection summary card
 */

import { DollarSign, Package } from 'lucide-react'

interface CashHandoffCardProps {
  totalCollected: number
  deliveryCount: number
  shiftDate?: string
  status?: 'PENDING' | 'RECEIVED' | 'DISCREPANCY'
}

export function CashHandoffCard({
  totalCollected,
  deliveryCount,
  shiftDate,
  status = 'PENDING'
}: CashHandoffCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'RECEIVED': return 'from-green-600 to-green-700'
      case 'DISCREPANCY': return 'from-orange-600 to-orange-700'
      default: return 'from-blue-600 to-blue-700'
    }
  }

  const getStatusLabel = () => {
    switch (status) {
      case 'RECEIVED': return 'Received'
      case 'DISCREPANCY': return 'Discrepancy'
      default: return 'Pending'
    }
  }

  return (
    <div className={`bg-gradient-to-br ${getStatusColor()} rounded-2xl p-6`}>
      {/* Status Badge */}
      {status !== 'PENDING' && (
        <div className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-medium text-white mb-4">
          {getStatusLabel()}
        </div>
      )}

      {/* Amount */}
      <p className="text-white/80 text-sm mb-1">Total Cash Collected</p>
      <div className="flex items-baseline gap-1 mb-4">
        <DollarSign className="w-8 h-8 text-white" />
        <span className="text-4xl font-bold text-white">
          {totalCollected.toLocaleString()}
        </span>
        <span className="text-xl text-white/80">XAF</span>
      </div>

      {/* Details */}
      <div className="flex items-center gap-2 text-white/80 text-sm">
        <Package className="w-4 h-4" />
        <span>
          {deliveryCount} {deliveryCount === 1 ? 'delivery' : 'deliveries'} completed
        </span>
      </div>

      {/* Date */}
      {shiftDate && (
        <p className="text-white/60 text-xs mt-3">
          {new Date(shiftDate).toLocaleDateString()} at {new Date(shiftDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}
