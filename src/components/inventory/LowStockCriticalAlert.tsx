'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useUser } from '@/hooks/use-user'

interface LowStockAlertData {
  productId: string
  productName: string
  sku: string
  quantity: number
  threshold: number
  sellerId: string
  timestamp: string
}

interface LowStockCriticalAlertProps {
  showForAll?: boolean // If true, show alerts for all sellers (admin view)
}

export function LowStockCriticalAlert({ showForAll = false }: LowStockCriticalAlertProps) {
  const { user } = useUser()
  const [alerts, setAlerts] = useState<LowStockAlertData[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)

  // Load dismissed alerts from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dismissedLowStockAlerts')
      if (stored) {
        setDismissed(new Set(JSON.parse(stored)))
      }
    } catch (error) {
      console.error('Failed to load dismissed alerts:', error)
    }
  }, [])

  // Save dismissed alerts to localStorage
  const saveDismissed = useCallback((ids: Set<string>) => {
    try {
      localStorage.setItem('dismissedLowStockAlerts', JSON.stringify([...ids]))
    } catch (error) {
      console.error('Failed to save dismissed alerts:', error)
    }
  }, [])

  // Fetch initial low stock alerts
  useEffect(() => {
    if (!user) return

    setIsLoading(true)
    fetch('/api/stock-alerts')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch alerts')
        return res.json()
      })
      .then((data) => {
        setAlerts(data.alerts || [])
      })
      .catch((error) => {
        console.error('Failed to fetch low stock alerts:', error)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [user])

  // Subscribe to Pusher for real-time low stock alerts
  useEffect(() => {
    if (!user || typeof window === 'undefined') return

    // Dynamically import Pusher to avoid SSR issues
    const setupPusher = async () => {
      try {
        const Pusher = (await import('pusher-js')).default

        // Get pusher config from window
        const pusherKey = (window as any).__PUSHER_KEY__
        const pusherCluster = (window as any).__PUSHER_CLUSTER__

        if (!pusherKey) {
          console.warn('Pusher key not found, skipping Pusher setup')
          return
        }

        const pusher = new Pusher(pusherKey, {
          cluster: pusherCluster || 'eu',
        })

        // Subscribe to seller-specific channel
        const channelName = showForAll
          ? 'activity-updates'
          : `seller-${user.id}`

        const channel = pusher.subscribe(channelName)

        channel.bind('low-stock-alert', (data: LowStockAlertData) => {
          // Check if this alert is for the current user or if showing for all
          if (showForAll || data.sellerId === user.id) {
            setAlerts((prev) => {
              // Check if this alert already exists
              const exists = prev.some((a) => a.productId === data.productId)
              if (exists) return prev
              return [...prev, data]
            })
          }
        })

        return () => {
          channel.unsubscribe()
          pusher.disconnect()
        }
      } catch (error) {
        console.error('Failed to setup Pusher:', error)
      }
    }

    const cleanupPromise = setupPusher()
    return () => {
      cleanupPromise.then((cleanup) => cleanup?.())
    }
  }, [user, showForAll])

  // Filter out dismissed alerts and alerts not for current user
  const visibleAlerts = alerts.filter(
    (alert) =>
      !dismissed.has(alert.productId) &&
      (showForAll || alert.sellerId === user?.id)
  )

  if (isLoading || visibleAlerts.length === 0) {
    return null
  }

  const handleDismiss = (productId: string) => {
    const newDismissed = new Set(dismissed)
    newDismissed.add(productId)
    setDismissed(newDismissed)
    saveDismissed(newDismissed)
  }

  // Show only the most critical alert (lowest quantity) first
  const primaryAlert = visibleAlerts.sort((a, b) => a.quantity - b.quantity)[0]

  return (
    <Alert className="mb-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
      <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
      <AlertDescription className="flex items-center justify-between gap-2">
        <span className="flex-1">
          <span className="font-semibold text-orange-900 dark:text-orange-100">
            Low Stock:
          </span>{' '}
          <span className="text-orange-700 dark:text-orange-300">
            {primaryAlert.productName} ({primaryAlert.sku}) — {primaryAlert.quantity} remaining
          </span>
          <span className="text-orange-600 dark:text-orange-400 ml-1">
            (threshold: {primaryAlert.threshold})
          </span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-orange-700 hover:text-orange-900 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900"
          onClick={() => handleDismiss(primaryAlert.productId)}
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  )
}
