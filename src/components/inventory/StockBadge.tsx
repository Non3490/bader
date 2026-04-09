'use client'

import { Package, AlertTriangle } from 'lucide-react'

interface StockBadgeProps {
  currentStock: number
  reorderPoint: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function StockBadge({
  currentStock,
  reorderPoint,
  size = 'md',
  showLabel = false
}: StockBadgeProps) {
  const isOutOfStock = currentStock === 0
  const isLowStock = currentStock > 0 && currentStock <= reorderPoint

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  if (isOutOfStock) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-red-100 text-red-800 font-medium ${sizes[size]}`}>
        <Package className={iconSizes[size]} />
        {showLabel && <span>Rupture de stock</span>}
        <span className="font-bold">{currentStock}</span>
      </span>
    )
  }

  if (isLowStock) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-orange-100 text-orange-800 font-medium ${sizes[size]}`}>
        <AlertTriangle className={iconSizes[size]} />
        {showLabel && <span>Stock faible</span>}
        <span className="font-bold">{currentStock}</span>
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-green-100 text-green-800 font-medium ${sizes[size]}`}>
      <Package className={iconSizes[size]} />
      {showLabel && <span>En stock</span>}
      <span className="font-bold">{currentStock}</span>
    </span>
  )
}

/**
 * Compact stock indicator for tables - just shows colored dot with count
 */
export function StockIndicator({
  currentStock,
  reorderPoint
}: {
  currentStock: number
  reorderPoint: number
}) {
  const isOutOfStock = currentStock === 0
  const isLowStock = currentStock > 0 && currentStock <= reorderPoint

  const colorClass = isOutOfStock
    ? 'bg-red-500'
    : isLowStock
    ? 'bg-orange-500'
    : 'bg-green-500'

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${colorClass}`} />
      <span className="text-sm font-medium text-gray-700">{currentStock}</span>
    </div>
  )
}
