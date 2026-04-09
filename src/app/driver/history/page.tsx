'use client'

/**
 * Driver Delivery History
 * Light theme matching admin dashboard
 * Shows past deliveries with performance stats
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Loader2
} from 'lucide-react'

interface HistoryDelivery {
  id: string
  status: string
  deliveredAt?: string
  returnedAt?: string
  returnReason?: string
  codCollected?: number
  order: {
    trackingNumber: string
    recipientName: string
    address: string
    city: string
    codAmount: number
  }
}

interface Stats {
  totalDelivered: number
  totalReturned: number
  totalCOD: number
  averageTime: number
  successRate: number
}

export default function DriverHistoryPage() {
  const router = useRouter()
  const [deliveries, setDeliveries] = useState<HistoryDelivery[]>([])
  const [stats, setStats] = useState<Stats>({
    totalDelivered: 0,
    totalReturned: 0,
    totalCOD: 0,
    averageTime: 0,
    successRate: 0
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/driver/deliveries?history=true')
      if (response.ok) {
        const data = await response.json()
        setDeliveries(data.deliveries)
        setStats(data.stats)
      } else if (response.status === 401) {
        router.push('/driver/login')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-gray-900 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Delivery History</h1>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-2xl font-bold">{stats.totalDelivered}</span>
            </div>
            <p className="text-gray-400 text-xs font-medium">Delivered Today</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <XCircle className="w-4 h-4" />
              <span className="text-2xl font-bold">{stats.totalReturned}</span>
            </div>
            <p className="text-gray-400 text-xs font-medium">Returned</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 text-orange-500 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-2xl font-bold">
                {stats.averageTime > 0 ? `${Math.round(stats.averageTime)}m` : '-'}
              </span>
            </div>
            <p className="text-gray-400 text-xs font-medium">Avg. Delivery Time</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 text-orange-500 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-2xl font-bold">{stats.successRate}%</span>
            </div>
            <p className="text-gray-400 text-xs font-medium">Success Rate</p>
          </div>
        </div>

        {/* Total COD */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-orange-600 font-semibold text-sm">Total COD Collected</span>
            <div className="flex items-center gap-1 text-xl font-bold text-orange-600">
              <DollarSign className="w-5 h-5" />
              {stats.totalCOD.toLocaleString()} XAF
            </div>
          </div>
        </div>

        {/* History List */}
        <div>
          <h2 className="text-lg font-bold mb-3">Recent Deliveries</h2>

          {deliveries.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-16 h-16 mx-auto text-gray-200 mb-4" />
              <p className="text-gray-400 font-medium">No delivery history yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveries.map(delivery => (
                <div
                  key={delivery.id}
                  className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm font-mono">
                      #{delivery.order.trackingNumber.slice(-6)}
                    </span>
                    <div className="flex items-center gap-1">
                      {delivery.status === 'DELIVERED' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-sm text-gray-400">
                        {delivery.deliveredAt
                          ? new Date(delivery.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : new Date(delivery.returnedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-gray-900 mb-1">
                    {delivery.order.recipientName}
                  </h3>

                  <p className="text-gray-400 text-sm mb-2">
                    {delivery.order.address}, {delivery.order.city}
                  </p>

                  {delivery.returnReason && (
                    <p className="text-red-500 text-xs mb-2 font-medium">
                      Reason: {delivery.returnReason.replace(/_/g, ' ').toLowerCase()}
                    </p>
                  )}

                  <div className="flex items-center gap-1 text-orange-600 text-sm font-bold">
                    <DollarSign className="w-4 h-4" />
                    {(delivery.codCollected ?? delivery.order.codAmount).toLocaleString()} XAF
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="flex items-center justify-around py-2">
          <button
            onClick={() => router.push('/driver/dashboard')}
            className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Package className="w-5 h-5" />
            <span className="text-[10px] font-medium">Deliveries</span>
          </button>

          <button
            onClick={() => router.push('/driver/route')}
            className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px] font-medium">Route</span>
          </button>

          <button
            onClick={() => router.push('/driver/history')}
            className="flex flex-col items-center gap-1 p-2 text-orange-500"
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px] font-semibold">History</span>
          </button>

          <button
            onClick={() => router.push('/driver/cash-summary')}
            className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <DollarSign className="w-5 h-5" />
            <span className="text-[10px] font-medium">Cash</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
