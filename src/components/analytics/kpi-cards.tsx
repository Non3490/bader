'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, DollarSign, TrendingUp, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KPICard {
  title: string
  value: string | number
  icon: React.ReactNode
  color: 'orange' | 'green' | 'blue' | 'dark'
  trend?: {
    value: number
    label: string
    positive: boolean
  }
}

interface KPICardsProps {
  cards: KPICard[]
  compareWithPrevious?: boolean
  className?: string
}

export function KPICards({ cards, compareWithPrevious, className }: KPICardsProps) {
  const getColorClasses = (color: KPICard['color']) => {
    switch (color) {
      case 'orange':
        return {
          bg: 'bg-orange-500/10',
          text: 'text-orange-600 dark:text-orange-400',
          border: 'border-orange-500/20',
          after: 'bg-orange-500'
        }
      case 'green':
        return {
          bg: 'bg-green-500/10',
          text: 'text-green-600 dark:text-green-400',
          border: 'border-green-500/20',
          after: 'bg-green-500'
        }
      case 'blue':
        return {
          bg: 'bg-blue-500/10',
          text: 'text-blue-600 dark:text-blue-400',
          border: 'border-blue-500/20',
          after: 'bg-blue-500'
        }
      case 'dark':
        return {
          bg: 'bg-zinc-500/10',
          text: 'text-zinc-600 dark:text-zinc-400',
          border: 'border-zinc-500/20',
          after: 'bg-zinc-500'
        }
    }
  }

  const getIcon = (color: KPICard['color']) => {
    switch (color) {
      case 'orange':
        return <Package className="h-4 w-4" />
      case 'green':
        return <DollarSign className="h-4 w-4" />
      case 'blue':
        return <TrendingUp className="h-4 w-4" />
      case 'dark':
        return <Truck className="h-4 w-4" />
    }
  }

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {cards.map((card, index) => {
        const colors = getColorClasses(card.color)
        return (
          <Card
            key={index}
            className={cn(
              'relative overflow-hidden transition-all hover:shadow-lg',
              colors.border
            )}
          >
            <div
              className={cn('absolute top-0 left-0 right-0 h-1', colors.after)}
            />
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className={cn('p-2 rounded-lg', colors.bg, colors.text)}>
                  {card.icon || getIcon(card.color)}
                </div>
                {compareWithPrevious && card.trend && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-medium',
                      card.trend.positive
                        ? 'border-green-500/30 text-green-600 bg-green-500/10'
                        : 'border-red-500/30 text-red-600 bg-red-500/10'
                    )}
                  >
                    {card.trend.positive ? '↑' : '↓'} {card.trend.label}
                  </Badge>
                )}
              </div>
              <div className="mt-3">
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold tracking-tight mt-1">{card.value}</p>
                {!compareWithPrevious && card.trend && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <span
                      className={cn(
                        'font-medium',
                        card.trend.positive ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {card.trend.positive ? '+' : ''}{card.trend.label}
                    </span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
