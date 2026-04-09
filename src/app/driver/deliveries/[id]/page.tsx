'use client'

/**
 * Delivery Detail Page
 * Light theme matching admin dashboard
 * - Delivered: confirmation with required COD amount input
 * - Returned: reason selection modal
 * - Postponed: required notes modal
 */

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  MapPin,
  Phone,
  Package,
  DollarSign,
  Navigation,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Clock,
  X,
  UserX,
  Home,
  MapPinOff,
  AlertTriangle,
  MessageSquare
} from 'lucide-react'

interface DeliveryItem {
  quantity: number
  product: {
    name: string
  }
}

interface Order {
  id: string
  trackingNumber: string
  recipientName: string
  phone: string
  address: string
  city: string
  note?: string
  codAmount: number
  status: string
  items: DeliveryItem[]
}

interface Delivery {
  id: string
  status: string
  assignedAt: string
  pickedUpAt?: string
  inTransitAt?: string
  deliveredAt?: string
  order: Order
}

const STATUS_FLOW: Record<string, string[]> = {
  'ASSIGNED': ['PICKED_UP'],
  'PICKED_UP': ['IN_TRANSIT'],
  'IN_TRANSIT': ['DELIVERED', 'RETURNED', 'POSTPONED']
}

const STATUS_LABELS: Record<string, string> = {
  'PICKED_UP': 'Picked Up',
  'IN_TRANSIT': 'In Transit',
  'DELIVERED': 'Delivered',
  'RETURNED': 'Return',
  'POSTPONED': 'Postponed'
}

const STATUS_COLORS: Record<string, string> = {
  'PICKED_UP': 'bg-yellow-500',
  'IN_TRANSIT': 'bg-purple-500',
  'DELIVERED': 'bg-green-500',
  'RETURNED': 'bg-red-500',
  'POSTPONED': 'bg-amber-500'
}

const RETURN_REASONS = [
  { value: 'CUSTOMER_REFUSED', label: 'Customer Refused', icon: UserX, color: 'text-red-500' },
  { value: 'NOT_HOME', label: 'Not At Home', icon: Home, color: 'text-orange-500' },
  { value: 'WRONG_ADDRESS', label: 'Wrong Address', icon: MapPinOff, color: 'text-yellow-600' },
  { value: 'DAMAGED', label: 'Damaged Package', icon: AlertTriangle, color: 'text-red-500' },
  { value: 'OTHER', label: 'Other Reason', icon: MessageSquare, color: 'text-gray-500' }
]

type ModalType = 'deliver' | 'return' | 'postpone' | null

export default function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState('')
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [postponeNotes, setPostponeNotes] = useState('')
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    fetchDelivery()
    getGpsLocation()
  }, [id])

  const fetchDelivery = async () => {
    try {
      const response = await fetch(`/api/driver/deliveries/${id}`)
      if (response.ok) {
        const data = await response.json()
        setDelivery(data.delivery)
      } else if (response.status === 401) {
        router.push('/driver/login')
      } else {
        const errData = await response.json().catch(() => null)
        console.error('FETCH ERROR:', response.status, errData)
        setError(errData?.debug || errData?.error || 'Failed to load delivery')
      }
    } catch {
      setError('Connection error')
    } finally {
      setIsLoading(false)
    }
  }

  const getGpsLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        () => {
          console.log('GPS permission denied or unavailable')
        }
      )
    }
  }

  const updateStatus = async (newStatus: string, codCollected?: number, notes?: string) => {
    setIsUpdating(true)
    setError('')

    try {
      const response = await fetch(`/api/driver/deliveries/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          gpsLat: gpsCoords?.lat,
          gpsLng: gpsCoords?.lng,
          codCollected,
          notes
        })
      })

      if (response.ok) {
        const data = await response.json()
        setDelivery(data.delivery)
        setActiveModal(null)
        if (['DELIVERED', 'RETURNED', 'POSTPONED'].includes(newStatus)) {
          router.push('/driver/dashboard')
        }
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update status')
      }
    } catch {
      setError('Connection error')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleReturn = async (reason: string) => {
    setIsUpdating(true)

    try {
      const response = await fetch(`/api/driver/deliveries/${id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          notes: '',
          gpsLat: gpsCoords?.lat,
          gpsLng: gpsCoords?.lng
        })
      })

      if (response.ok) {
        router.push('/driver/dashboard')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to mark as returned')
      }
    } catch {
      setError('Connection error')
    } finally {
      setIsUpdating(false)
      setActiveModal(null)
    }
  }

  const openMaps = () => {
    if (!delivery) return
    const address = encodeURIComponent(`${delivery.order.address}, ${delivery.order.city}`)
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, '_blank')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    )
  }

  if (!delivery || error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4 font-medium">{error || 'Delivery not found'}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const allowedStatuses = STATUS_FLOW[delivery.status] || []
  const isTerminal = ['DELIVERED', 'RETURNED'].includes(delivery.status)
  const isInTransit = delivery.status === 'IN_TRANSIT'

  return (
    <div className="min-h-screen bg-background text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Delivery Details</h1>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-28">
        {/* Order Info Card */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm font-mono">#{delivery.order.trackingNumber}</span>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
              delivery.status === 'IN_TRANSIT' ? 'bg-purple-100 text-purple-700' :
              delivery.status === 'PICKED_UP' ? 'bg-yellow-100 text-yellow-700' :
              delivery.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {STATUS_LABELS[delivery.status] || delivery.status}
            </span>
          </div>

          {/* Customer */}
          <h2 className="text-xl font-bold mb-1">{delivery.order.recipientName}</h2>

          {/* Address */}
          <div className="flex items-start gap-2 text-gray-400 mb-4">
            <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
            <p className="text-sm">{delivery.order.address}, {delivery.order.city}</p>
          </div>

          {/* Contact Button */}
          <a
            href={`tel:${delivery.order.phone}`}
            className="flex items-center justify-center gap-2 w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-semibold text-white transition-colors"
          >
            <Phone className="w-5 h-5" />
            Call Customer
          </a>

          {/* Navigation Button */}
          <button
            onClick={openMaps}
            className="flex items-center justify-center gap-2 w-full py-3 bg-gray-50 hover:bg-gray-100 rounded-xl font-semibold text-gray-700 transition-colors mt-2 border border-gray-200"
          >
            <Navigation className="w-5 h-5" />
            Open Navigation
          </button>
        </div>

        {/* Order Items */}
        {delivery.order.items?.length > 0 && (
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <h3 className="font-bold mb-3 flex items-center gap-2 text-gray-900">
              <Package className="w-4 h-4 text-gray-400" />
              Items
            </h3>
            <div className="space-y-2">
              {delivery.order.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600">{item.quantity}x {item.product.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COD Amount */}
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
          <div className="flex items-center justify-between">
            <span className="text-orange-600 font-semibold text-sm">Cash on Delivery</span>
            <div className="flex items-center gap-1 text-xl font-bold text-orange-600">
              <DollarSign className="w-5 h-5" />
              {delivery.order.codAmount.toLocaleString()} XAF
            </div>
          </div>
        </div>

        {/* Note */}
        {delivery.order.note && (
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <h3 className="font-bold mb-2 text-gray-900">Note</h3>
            <p className="text-gray-500 text-sm">{delivery.order.note}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm font-medium">{error}</p>
          </div>
        )}
      </main>

      {/* Status Update Buttons (Fixed at Bottom) */}
      {!isTerminal && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 space-y-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          {isInTransit ? (
            <>
              <button
                onClick={() => setActiveModal('deliver')}
                disabled={isUpdating}
                className="w-full h-14 rounded-xl font-bold text-white bg-green-500 hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
              >
                <CheckCircle2 className="w-5 h-5" />
                Mark as Delivered
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => setActiveModal('return')}
                  disabled={isUpdating}
                  className="flex-1 h-14 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                >
                  <RotateCcw className="w-5 h-5" />
                  Return
                </button>
                <button
                  onClick={() => { setPostponeNotes(''); setActiveModal('postpone') }}
                  disabled={isUpdating}
                  className="flex-1 h-14 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                >
                  <Clock className="w-5 h-5" />
                  Postpone
                </button>
              </div>
            </>
          ) : (
            allowedStatuses.map(status => (
              <button
                key={status}
                onClick={() => updateStatus(status)}
                disabled={isUpdating}
                className={`w-full h-14 rounded-xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm ${STATUS_COLORS[status]}`}
              >
                {isUpdating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  STATUS_LABELS[status]
                )}
              </button>
            ))
          )}
        </div>
      )}

      {/* ============ MODALS ============ */}

      {/* Deliver Confirmation Modal */}
      {activeModal === 'deliver' && delivery && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl">
            <div className="bg-green-500 p-6 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-white" />
              <h3 className="text-xl font-bold text-white">Confirm Delivery</h3>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-600 text-center">
                Did you deliver to <span className="text-gray-900 font-bold">{delivery.order.recipientName}</span>?
              </p>

              <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-center">
                <p className="text-green-600 text-sm mb-1">Cash Collected</p>
                <p className="text-2xl font-bold text-green-600">
                  {delivery.order.codAmount.toLocaleString()} XAF
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => updateStatus('DELIVERED', delivery.order.codAmount)}
                  disabled={isUpdating}
                  className="w-full h-14 rounded-xl font-bold text-white bg-green-500 hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUpdating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Yes, Delivered
                    </>
                  )}
                </button>
                <button
                  onClick={() => setActiveModal(null)}
                  disabled={isUpdating}
                  className="w-full h-12 rounded-xl font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Reason Modal */}
      {activeModal === 'return' && delivery && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50">
          <div className="bg-white w-full rounded-t-2xl max-h-[85vh] overflow-y-auto shadow-xl">
            <div className="bg-red-500 p-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-white" />
                <h3 className="text-lg font-bold text-white">Return Delivery</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 pt-4 pb-2">
              <p className="text-gray-400 text-sm">Why is this order being returned?</p>
              <p className="text-gray-900 font-bold mt-1">{delivery.order.recipientName}</p>
              <p className="text-gray-400 text-sm">{delivery.order.address}, {delivery.order.city}</p>
            </div>

            <div className="p-5 space-y-2">
              {RETURN_REASONS.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  onClick={() => handleReturn(value)}
                  disabled={isUpdating}
                  className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-xl text-left transition-colors flex items-center gap-3 disabled:opacity-50 border border-gray-100"
                >
                  <Icon className={`w-5 h-5 ${color}`} />
                  <span className="font-semibold text-gray-700">{label}</span>
                </button>
              ))}

              <button
                onClick={() => setActiveModal(null)}
                disabled={isUpdating}
                className="w-full p-4 text-gray-400 hover:text-gray-600 transition-colors text-center font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Postpone Modal */}
      {activeModal === 'postpone' && delivery && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl">
            <div className="bg-amber-500 p-6 text-center">
              <Clock className="w-12 h-12 mx-auto mb-2 text-white" />
              <h3 className="text-xl font-bold text-white">Postpone Delivery</h3>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-600 text-center">
                Postpone delivery to <span className="text-gray-900 font-bold">{delivery.order.recipientName}</span>?
              </p>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason for postponing <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={postponeNotes}
                  onChange={(e) => setPostponeNotes(e.target.value)}
                  placeholder="Type the reason..."
                  rows={3}
                  autoFocus
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
                />
                {postponeNotes.trim().length === 0 && (
                  <p className="text-red-500 text-sm mt-1">A reason is required to postpone</p>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => {
                    if (!postponeNotes.trim()) return
                    updateStatus('POSTPONED', undefined, postponeNotes.trim())
                  }}
                  disabled={isUpdating || !postponeNotes.trim()}
                  className="w-full h-14 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUpdating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Clock className="w-5 h-5" />
                      Postpone Delivery
                    </>
                  )}
                </button>
                <button
                  onClick={() => setActiveModal(null)}
                  disabled={isUpdating}
                  className="w-full h-12 rounded-xl font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
