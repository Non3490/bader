'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import PusherClient from 'pusher-js'
import { cn } from '@/lib/utils'

interface LowStockAlert {
  stockId: string
  productId: string
  productName: string
  productSku: string
  quantity: number
  threshold: number
  timestamp: string
}

interface GlobalLowStockBannerProps {
  userRole: string
  userId: string
}

const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || ''
const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu'

export function GlobalLowStockBanner({ userRole, userId }: GlobalLowStockBannerProps) {
  const [alerts, setAlerts] = useState<LowStockAlert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Fetch initial alerts
    async function fetchAlerts() {
      try {
        const res = await fetch('/api/stock/alerts')
        if (res.ok) {
          const data = await res.json()
          setAlerts(data.alerts || [])
        }
      } catch (error) {
        console.error('Failed to fetch low stock alerts:', error)
      }
    }

    fetchAlerts()

    // Set up Pusher for real-time alerts
    if (pusherKey && (userRole === 'ADMIN' || userRole === 'SELLER')) {
      const pusher = new PusherClient(pusherKey, {
        cluster: pusherCluster,
      })

      // Admin listens to activity channel, sellers listen to their own channel
      const channelName = userRole === 'ADMIN' ? 'activity-updates' : `seller-${userId}`
      const channel = pusher.subscribe(channelName)

      channel.bind('low-stock-alert', (data: LowStockAlert) => {
        setAlerts((prev) => {
          // Avoid duplicates
          const exists = prev.some((a) => a.productId === data.productId)
          if (exists) return prev
          return [data, ...prev]
        })
      })

      return () => {
        channel.unbind_all()
        channel.unsubscribe()
      }
    }
  }, [userRole, userId])

  // Filter out dismissed alerts and alerts not relevant to user
  const visibleAlerts = alerts.filter(
    (alert) => !dismissed.has(alert.productId)
  )

  if (visibleAlerts.length === 0) return null

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2">
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
        <div className="flex-1">
          <div className="font-semibold text-amber-900">
            Low Stock Alert{visibleAlerts.length > 1 ? `s` : ''} ({visibleAlerts.length})
          </div>
          <div className="mt-1 space-y-1 text-sm text-amber-800">
            {visibleAlerts.slice(0, 3).map((alert) => (
              <div key={alert.productId} className="flex items-center justify-between">
                <span>
                  <strong>{alert.productName}</strong> (SKU: {alert.productSku}) —{' '}
                  <span className="text-amber-900 font-semibold">{alert.quantity} left</span>
                  </span>
              </div>
            ))}
            {visibleAlerts.length > 3 && (
              <div className="text-amber-700">
                +{visibleAlerts.length - 3} more products low on stock
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            visibleAlerts.forEach((alert) => {
              setDismissed((prev) => new Set([...prev, alert.productId]))
            })
          }}
          className="text-amber-600 hover:text-amber-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
