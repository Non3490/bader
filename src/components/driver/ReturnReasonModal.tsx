'use client'

/**
 * ReturnReasonModal Component
 * Modal for selecting return reason
 */

import { X } from 'lucide-react'

interface ReturnReasonModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (reason: string) => void
}

const RETURN_REASONS = [
  { value: 'CUSTOMER_REFUSED', label: 'Customer Refused', description: 'Customer did not want the order' },
  { value: 'NOT_HOME', label: 'Not Home', description: 'Customer was not available' },
  { value: 'WRONG_ADDRESS', label: 'Wrong Address', description: 'Address was incorrect or not found' },
  { value: 'DAMAGED', label: 'Damaged', description: 'Item was damaged during delivery' },
  { value: 'OTHER', label: 'Other', description: 'Another reason' }
]

export function ReturnReasonModal({ isOpen, onClose, onSelect }: ReturnReasonModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-end justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 w-full max-w-lg rounded-t-2xl p-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Return Delivery</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-slate-400 text-sm mb-6">
          Select a reason for returning this delivery. This will be recorded for admin review.
        </p>

        {/* Reason Options */}
        <div className="space-y-3">
          {RETURN_REASONS.map((reason) => (
            <button
              key={reason.value}
              onClick={() => {
                onSelect(reason.value)
                onClose()
              }}
              className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-left transition-colors border border-slate-600"
            >
              <h3 className="font-semibold text-white mb-1">{reason.label}</h3>
              <p className="text-sm text-slate-400">{reason.description}</p>
            </button>
          ))}
        </div>

        {/* Cancel */}
        <button
          onClick={onClose}
          className="w-full mt-6 p-4 text-slate-400 hover:text-white transition-colors font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
