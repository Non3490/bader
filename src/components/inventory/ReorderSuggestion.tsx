'use client'

import { ShoppingCart, Phone, AlertTriangle } from 'lucide-react'

interface ReorderSuggestionProps {
  productName: string
  currentStock: number
  reorderPoint: number
  suggestedQuantity: number
  estimatedCost: number
  urgency?: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  supplierName?: string | null
  supplierPhone?: string | null
  onOrderClick?: () => void
}

export function ReorderSuggestion({
  productName,
  currentStock,
  reorderPoint,
  suggestedQuantity,
  estimatedCost,
  urgency = 'MEDIUM',
  supplierName,
  supplierPhone,
  onOrderClick
}: ReorderSuggestionProps) {
  const urgencyConfig = {
    CRITICAL: {
      bg: 'bg-red-50 border-red-200',
      badge: 'bg-red-100 text-red-800',
      icon: 'text-red-600'
    },
    HIGH: {
      bg: 'bg-orange-50 border-orange-200',
      badge: 'bg-orange-100 text-orange-800',
      icon: 'text-orange-600'
    },
    MEDIUM: {
      bg: 'bg-yellow-50 border-yellow-200',
      badge: 'bg-yellow-100 text-yellow-800',
      icon: 'text-yellow-600'
    }
  }

  const config = urgencyConfig[urgency]

  return (
    <div className={`p-4 rounded-lg border ${config.bg}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">{productName}</h4>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
            <span>Stock actuel: <strong className="text-gray-900">{currentStock}</strong></span>
            <span>Seuil: <strong className="text-gray-900">{reorderPoint}</strong></span>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.badge}`}>
          {urgency === 'CRITICAL' ? 'Critique' : urgency === 'HIGH' ? 'Urgent' : 'À commander'}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Quantité suggérée:</span>
          <span className="font-semibold text-gray-900">{suggestedQuantity} unités</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Coût estimé:</span>
          <span className="font-semibold text-gray-900">
            {estimatedCost.toLocaleString('fr-FR')} FCFA
          </span>
        </div>
        {supplierName && (
          <div className="flex items-center gap-2 text-gray-600">
            <ShoppingCart className="w-4 h-4" />
            <span>Fournisseur: {supplierName}</span>
          </div>
        )}
        {supplierPhone && (
          <div className="flex items-center gap-2 text-gray-600">
            <Phone className="w-4 h-4" />
            <a
              href={`tel:${supplierPhone}`}
              className="text-blue-600 hover:underline"
            >
              {supplierPhone}
            </a>
          </div>
        )}
      </div>

      {onOrderClick && (
        <button
          onClick={onOrderClick}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <ShoppingCart className="w-4 h-4" />
          Enregistrer la commande
        </button>
      )}
    </div>
  )
}

/**
 * Compact reorder suggestion for table rows
 */
export function CompactReorderSuggestion({
  currentStock,
  reorderPoint,
  suggestedQuantity,
  estimatedCost
}: {
  currentStock: number
  reorderPoint: number
  suggestedQuantity: number
  estimatedCost: number
}) {
  const urgency = currentStock === 0 ? 'CRITICAL' : currentStock <= reorderPoint / 2 ? 'HIGH' : 'MEDIUM'

  const urgencyColors = {
    CRITICAL: 'text-red-600 bg-red-50',
    HIGH: 'text-orange-600 bg-orange-50',
    MEDIUM: 'text-yellow-600 bg-yellow-50'
  }

  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${urgencyColors[urgency]}`}>
      <AlertTriangle className="w-3 h-3" />
      <span className="font-medium">{suggestedQuantity} à commander</span>
      <span className="text-gray-600">({estimatedCost.toLocaleString('fr-FR')} FCFA)</span>
    </div>
  )
}
