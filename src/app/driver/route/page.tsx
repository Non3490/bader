'use client'

/**
 * Driver Route View
 * Shows deliveries sorted by proximity with navigation links
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  MapPin,
  Navigation,
  DollarSign,
  Loader2,
  Package
} from 'lucide-react'

interface Order {
  trackingNumber: string
  recipientName: string
  phone: string
  address: string
  city: string
  codAmount: number
}

interface Delivery {
  id: string
  status: string
  distance?: number
  estimatedMinutes?: number
  order: Order
}

export default function DriverRoutePage() {
  const router = useRouter()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    getUserLocation()
  }, [])

  useEffect(() => {
    if (userLocation) {
      fetchRoute()
    }
  }, [userLocation])

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        () => {
          // If GPS fails, load route without sorting
          fetchRoute()
        }
      )
    } else {
      fetchRoute()
    }
  }

  const fetchRoute = async () => {
    setIsLoading(true)
    try {
      const url = userLocation
        ? `/api/driver/route?lat=${userLocation.lat}&lng=${userLocation.lng}`
        : '/api/driver/route'

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setDeliveries(data.deliveries)
      } else if (response.status === 401) {
        router.push('/driver/login')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const openNavigation = (address: string, city: string) => {
    const encoded = encodeURIComponent(`${address}, ${city}`)
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank')
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
          <div>
            <h1 className="text-lg font-semibold">Route</h1>
            <p className="text-sm text-slate-400">
              {userLocation ? 'Sorted by distance' : 'Enable GPS for sorting'}
            </p>
          </div>
        </div>
      </header>

      {/* Summary Card */}
      <div className="px-4 py-4">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Today's Route</p>
              <p className="text-2xl font-bold">{deliveries.length} Stops</p>
            </div>
            <div className="text-right">
              <p className="text-blue-100 text-sm">Total COD</p>
              <p className="text-xl font-bold">
                {deliveries.reduce((sum, d) => sum + d.order.codAmount, 0).toLocaleString()} XAF
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Deliveries List */}
      <main className="px-4">
        {deliveries.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">No active deliveries</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deliveries.map((delivery, index) => (
              <div
                key={delivery.id}
                className="bg-slate-800 rounded-xl p-4 border border-slate-700"
              >
                {/* Distance Badge */}
                {delivery.distance !== null && (
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">
                          {delivery.distance?.toFixed(1)} km away
                        </p>
                        <p className="text-xs text-slate-500">
                          {delivery.estimatedMinutes} min drive
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Customer Info */}
                <h3 className="font-semibold text-white mb-1">
                  {delivery.order.recipientName}
                </h3>

                <div className="flex items-start gap-2 text-slate-400 text-sm mb-3">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{delivery.order.address}, {delivery.order.city}</span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-green-400 font-semibold">
                    <DollarSign className="w-4 h-4" />
                    {delivery.order.codAmount.toLocaleString()} XAF
                  </div>

                  <button
                    onClick={() => openNavigation(delivery.order.address, delivery.order.city)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                  >
                    <Navigation className="w-4 h-4" />
                    Navigate
                  </button>
                </div>
              </div>
            ))}
          </div>
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
            className="flex flex-col items-center gap-1 p-2 text-blue-500"
          >
            <Navigation className="w-5 h-5" />
            <span className="text-xs">Route</span>
          </button>

          <button
            onClick={() => router.push('/driver/cash-summary')}
            className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors"
          >
            <DollarSign className="w-5 h-5" />
            <span className="text-xs">Cash</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
