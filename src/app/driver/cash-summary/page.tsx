'use client'

/**
 * Driver Cash Summary & End Shift
 * Shows today's cash collected and allows ending shift
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  DollarSign,
  Package,
  LogOut,
  Loader2,
  CheckCircle
} from 'lucide-react'

interface CashDelivery {
  id: string
  codCollected?: number
  deliveredAt: string
  order: {
    trackingNumber: string
    codAmount: number
  }
}

interface CashSummary {
  deliveryCount: number
  totalCollected: number
  deliveries: CashDelivery[]
}

export default function CashSummaryPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<CashSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEndingShift, setIsEndingShift] = useState(false)
  const [shiftEnded, setShiftEnded] = useState(false)

  useEffect(() => {
    fetchSummary()
  }, [])

  const fetchSummary = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/driver/end-shift')
      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      } else if (response.status === 401) {
        router.push('/driver/login')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const endShift = async () => {
    setIsEndingShift(true)
    try {
      const response = await fetch('/api/driver/end-shift', {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        setShiftEnded(true)
        setSummary({
          deliveryCount: data.cashHandoff.deliveryCount,
          totalCollected: data.cashHandoff.totalCollected,
          deliveries: summary?.deliveries || []
        })

        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push('/driver/login')
        }, 2000)
      }
    } finally {
      setIsEndingShift(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Cash Summary</h1>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {shiftEnded ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-600 rounded-full mb-4">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-green-400 mb-2">Shift Ended</h2>
            <p className="text-slate-400">Your cash handoff has been recorded.</p>
            <p className="text-slate-500 text-sm mt-2">Redirecting to login...</p>
          </div>
        ) : (
          <>
            {/* Total Cash Card */}
            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-6">
              <p className="text-green-100 text-sm mb-1">Total Cash Collected</p>
              <div className="flex items-baseline gap-1">
                <DollarSign className="w-8 h-8" />
                <span className="text-4xl font-bold">
                  {summary?.totalCollected.toLocaleString() || 0}
                </span>
                <span className="text-xl">XAF</span>
              </div>
              <p className="text-green-100 mt-4 text-sm">
                {summary?.deliveryCount || 0} {summary?.deliveryCount === 1 ? 'delivery' : 'deliveries'} completed
              </p>
            </div>

            {/* Deliveries List */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Today's Deliveries</h2>

              {summary && summary.deliveries.length > 0 ? (
                <div className="space-y-2">
                  {summary.deliveries.map(delivery => (
                    <div
                      key={delivery.id}
                      className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            #{delivery.order.trackingNumber.slice(-6)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(delivery.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-green-400 font-semibold">
                        <DollarSign className="w-4 h-4" />
                        {(delivery.codCollected ?? delivery.order.codAmount).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-800 rounded-xl border border-slate-700">
                  <Package className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400">No deliveries completed today</p>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <h3 className="font-semibold mb-2">Handoff Instructions</h3>
              <ol className="text-sm text-slate-400 space-y-1 list-decimal list-inside">
                <li>Count your cash to verify the total amount</li>
                <li>Hand over the cash to your supervisor/admin</li>
                <li>Tap "End Shift" to record the handoff</li>
              </ol>
            </div>

            {/* End Shift Button */}
            <button
              onClick={endShift}
              disabled={isEndingShift || (summary?.deliveryCount || 0) === 0}
              className="w-full h-16 bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isEndingShift ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <LogOut className="w-5 h-5" />
                  End Shift & Record Handoff
                </>
              )}
            </button>
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700">
        <div className="flex items-center justify-around py-2">
          <button
            onClick={() => router.push('/driver/dashboard')}
            className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors"
          >
            <Package className="w-5 h-5" />
            <span className="text-xs">Deliveries</span>
          </button>

          <button
            onClick={() => router.push('/driver/route')}
            className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors"
          >
            <Package className="w-5 h-5" />
            <span className="text-xs">Route</span>
          </button>

          <button
            onClick={() => router.push('/driver/history')}
            className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors"
          >
            <Package className="w-5 h-5" />
            <span className="text-xs">History</span>
          </button>

          <button
            onClick={() => router.push('/driver/cash-summary')}
            className="flex flex-col items-center gap-1 p-2 text-blue-500"
          >
            <DollarSign className="w-5 h-5" />
            <span className="text-xs">Cash</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
