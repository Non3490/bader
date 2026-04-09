'use client'

import { cn } from '@/lib/utils'

type StatusVariant =
  | 'success'
  | 'danger'
  | 'info'
  | 'warning'
  | 'orange'
  | 'purple'
  | 'sky'
  | 'gray'

interface StatusBadgeProps {
  status: string
  variant?: StatusVariant
  className?: string
}

const variantStyles: Record<StatusVariant, string> = {
  success: 'bg-[#f0fdf4] text-success',
  danger: 'bg-[#fef2f2] text-danger',
  info: 'bg-[#eff6ff] text-info',
  warning: 'bg-[#fffbeb] text-warning',
  orange: 'bg-[#fff4e8] text-orange',
  purple: 'bg-[#f5f3ff] text-purple',
  sky: 'bg-[#ecfeff] text-sky',
  gray: 'bg-[#f3f4f6] text-text-muted',
}

// Auto-detect variant from status text
function detectVariant(status: string): StatusVariant {
  const s = status.toLowerCase()
  if (s.includes('livré') || s.includes('delivered') || s.includes('confirmed') || s.includes('confirmé') || s.includes('active') || s.includes('actif')) {
    return 'success'
  }
  if (s.includes('annulé') || s.includes('cancelled') || s.includes('rejected') || s.includes('refusé') || s.includes('error') || s.includes('erreur')) {
    return 'danger'
  }
  if (s.includes('en cours') || s.includes('in progress') || s.includes('pending') || s.includes('attente') || s.includes('shipped') || s.includes('expédié')) {
    return 'orange'
  }
  if (s.includes('retourné') || s.includes('returned') || s.includes('failed') || s.includes('échoué')) {
    return 'warning'
  }
  if (s.includes('nouveau') || s.includes('new') || s.includes('draft') || s.includes('brouillon')) {
    return 'info'
  }
  return 'gray'
}

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const detectedVariant = variant || detectVariant(status)
  const style = variantStyles[detectedVariant]

  return (
    <span
      className={cn(
        'inline-flex px-2 py-0.5 rounded-[5px] text-[9px] font-bold uppercase tracking-tighter',
        style,
        className
      )}
    >
      {status}
    </span>
  )
}
