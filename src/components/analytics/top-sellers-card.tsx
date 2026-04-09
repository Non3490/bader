'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SellerRanking {
  sellerId: string
  sellerName: string
  sellerEmail: string
  totalRevenue: number
  orderVolume: number
  deliveryRate: number
  confirmationRate: number
  avgOrderValue: number
  rank?: number
}

interface TopSellersCardProps {
  sellers: SellerRanking[]
  topPerformer?: SellerRanking | null
  onSellerClick?: (sellerId: string) => void
  className?: string
}

export function TopSellersCard({ sellers, topPerformer, onSellerClick, className }: TopSellersCardProps) {
  const fmt = (v: number) =>
    new Intl.NumberFormat('fr-GA', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(v)

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />
      default:
        return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
    }
  }

  const getRankBadgeClass = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
      case 2:
        return 'bg-gray-400/10 border-gray-400/30 text-gray-700 dark:text-gray-400'
      case 3:
        return 'bg-amber-600/10 border-amber-600/30 text-amber-700 dark:text-amber-400'
      default:
        return 'bg-muted'
    }
  }

  return (
    <Card className={cn('', className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h3 className="text-sm font-bold text-foreground">Top Sellers Leaderboard</h3>
        </div>

        {sellers.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">No seller data yet</p>
        ) : (
          <div className="space-y-2">
            {sellers.slice(0, 5).map((seller) => (
              <div
                key={seller.sellerId}
                onClick={() => onSellerClick?.(seller.sellerId)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-all',
                  seller.rank === 1 ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-muted/30 hover:bg-muted/50',
                  onSellerClick && 'cursor-pointer'
                )}
              >
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', getRankBadgeClass(seller.rank || 0))}>
                  {getRankIcon(seller.rank || 0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{seller.sellerName}</p>
                    {seller.rank === 1 && (
                      <Badge variant="outline" className="text-xs bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400">
                        Top
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Del rate: <span className={cn(
                      'font-semibold',
                      seller.deliveryRate >= 80 ? 'text-green-600' : seller.deliveryRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                    )}>{seller.deliveryRate}%</span>
                    {' · '}{seller.orderVolume} orders
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">{fmt(seller.totalRevenue)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
