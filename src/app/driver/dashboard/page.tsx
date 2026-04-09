'use client'

/**
 * Driver Dashboard - Active Deliveries List
 * Light theme matching admin dashboard
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package,
  MapPin,
  Phone,
  DollarSign,
  LogOut,
  Route as RouteIcon,
  History,
  Wallet
} from 'lucide-react'

interface Delivery {
  id: string
  status: string
  assignedAt: string
  order: {
    id: string
    trackingNumber: string
    recipientName: string
    phone: string
    address: string
    city: string
    codAmount: number
    status: string
  }
}

interface Driver {
  id: string
  name: string
  status: string
}

export default function DriverDashboardPage() {
  const router = useRouter()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [driver, setDriver] = useState<Driver | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDeliveries()
    fetchDriver()
  }, [])

  const fetchDeliveries = async () => {
    try {
      const response = await fetch('/api/driver/deliveries')
      if (response.ok) {
        const data = await response.json()
        setDeliveries(data.deliveries)
      } else if (response.status === 401) {
        router.push('/driver/login')
      }
    } catch (error) {
      console.error('Failed to fetch deliveries:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchDriver = async () => {
    try {
      const response = await fetch('/api/driver-auth/me')
      if (response.ok) {
        const data = await response.json()
        setDriver(data.driver)
      }
    } catch (error) {
      console.error('Failed to fetch driver:', error)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/driver-auth/logout', { method: 'POST' })
    router.push('/driver/login')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED': return 'bg-blue-100 text-blue-700'
      case 'PICKED_UP': return 'bg-yellow-100 text-yellow-700'
      case 'IN_TRANSIT': return 'bg-purple-100 text-purple-700'
      case 'DELIVERED': return 'bg-green-100 text-green-700'
      case 'RETURNED': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ASSIGNED': return 'Assigned'
      case 'PICKED_UP': return 'Picked Up'
      case 'IN_TRANSIT': return 'In Transit'
      case 'DELIVERED': return 'Delivered'
      case 'RETURNED': return 'Returned'
      default: return status
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-gray-900 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">My Deliveries</h1>
            {driver && (
              <p className="text-sm text-gray-400">{deliveries.length} active</p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push('/driver/route')}
              className="p-2 text-gray-400 hover:text-orange-500 transition-colors rounded-lg hover:bg-gray-50"
            >
              <RouteIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => router.push('/driver/cash-summary')}
              className="p-2 text-gray-400 hover:text-orange-500 transition-colors rounded-lg hover:bg-gray-50"
            >
              <Wallet className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Driver Status */}
        {driver && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
              <div className={`w-2.5 h-2.5 rounded-full ${
                driver.status === 'AVAILABLE' ? 'bg-green-500' :
                driver.status === 'ON_DELIVERY' ? 'bg-yellow-500' :
                'bg-gray-400'
              }`} />
              <span className="text-sm text-gray-600">
                {driver.status === 'AVAILABLE' ? 'Available' :
                 driver.status === 'ON_DELIVERY' ? 'On Delivery' :
                 'Offline'}
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Deliveries List */}
      <main className="px-4 py-4">
        {deliveries.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 mx-auto text-gray-200 mb-4" />
            <h2 className="text-lg font-semibold text-gray-400 mb-2">No Active Deliveries</h2>
            <p className="text-gray-300 text-sm">You have no assigned deliveries right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deliveries.map(delivery => (
              <button
                key={delivery.id}
                onClick={() => router.push(`/driver/deliveries/${delivery.id}`)}
                className="w-full bg-white rounded-xl p-4 border border-gray-200 text-left hover:border-orange-200 hover:shadow-md transition-all active:scale-[0.98]"
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getStatusColor(delivery.status)}`}>
                    {getStatusLabel(delivery.status)}
                  </span>
                  <span className="text-gray-400 text-xs font-mono">
                    #{delivery.order.trackingNumber.slice(-6)}
                  </span>
                </div>

                {/* Customer Info */}
                <h3 className="font-bold text-gray-900 mb-1">
                  {delivery.order.recipientName}
                </h3>

                {/* Address */}
                <div className="flex items-start gap-2 text-gray-400 text-sm mb-3">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{delivery.order.address}, {delivery.order.city}</span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-orange-600 font-bold">
                    <DollarSign className="w-4 h-4" />
                    {delivery.order.codAmount.toLocaleString()} XAF
                  </div>

                  <a
                    href={`tel:${delivery.order.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-blue-500 hover:text-blue-600 transition-colors font-medium"
                  >
                    <Phone className="w-4 h-4" />
                    Call
                  </a>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="flex items-center justify-around py-2">
          <button
            onClick={() => router.push('/driver/dashboard')}
            className="flex flex-col items-center gap-1 p-2 text-orange-500"
          >
            <Package className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Deliveries</span>
          </button>

          <button
            onClick={() => router.push('/driver/route')}
            className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RouteIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">Route</span>
          </button>

          <button
            onClick={() => router.push('/driver/history')}
            className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <History className="w-5 h-5" />
            <span className="text-[10px] font-medium">History</span>
          </button>

          <button
            onClick={() => router.push('/driver/cash-summary')}
            className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[10px] font-medium">Cash</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
