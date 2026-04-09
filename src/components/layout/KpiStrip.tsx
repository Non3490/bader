'use client'

import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

export interface KpiItem {
  label: string
  value: string | number
  subtitle?: string
  trend?: {
    value: string
    direction: 'up' | 'down' | 'neutral'
  }
  color: 'orange' | 'green' | 'blue' | 'dark' | 'success' | 'info' | 'danger' | 'warning'
  icon?: LucideIcon
}

interface KpiStripProps {
  items: KpiItem[]
  className?: string
}

const colorClasses = {
  orange: {
    border: 'border-t-orange',
    icon: 'text-orange',
  },
  green: {
    border: 'border-t-success',
    icon: 'text-success',
  },
  blue: {
    border: 'border-t-info',
    icon: 'text-info',
  },
  dark: {
    border: 'border-t-text-primary',
    icon: 'text-text-primary',
  },
  success: {
    border: 'border-t-success',
    icon: 'text-success',
  },
  info: {
    border: 'border-t-info',
    icon: 'text-info',
  },
  danger: {
    border: 'border-t-danger',
    icon: 'text-danger',
  },
  warning: {
    border: 'border-t-warning',
    icon: 'text-warning',
  },
}

const trendColors = {
  up: 'text-success',
  down: 'text-danger',
  neutral: 'text-text-secondary',
}

export function KpiStrip({ items, className = '' }: KpiStripProps) {
  return (
    <div className={`grid grid-cols-4 gap-6 ${className}`}>
      {items.map((item, index) => {
        const Icon = item.icon
        const colors = colorClasses[item.color]

        return (
          <div
            key={index}
            className="bg-surface p-5 rounded-[10px] border-t-[2.5px] shadow-sm"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-text-secondary text-[10px] font-bold uppercase tracking-wider">
                {item.label}
              </span>
              {Icon && (
                <Icon className={`w-[18px] h-[18px] ${colors.icon}`} />
              )}
            </div>
            <div className="text-[26px] font-extrabold text-text-primary mb-1">
              {item.value}
            </div>
            {item.subtitle && (
              <div className="text-[9px] text-text-muted font-medium">
                {item.subtitle}
              </div>
            )}
            {item.trend && (
              <div className={`text-[11px] ${trendColors[item.trend.direction]} font-bold flex items-center gap-1 mt-1`}>
                {item.trend.direction === 'up' && '↑'}
                {item.trend.direction === 'down' && '↓'}
                {item.trend.value}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
