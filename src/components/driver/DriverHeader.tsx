'use client'

/**
 * DriverHeader Component
 * Mobile header with driver status toggle
 */

import { LogOut, Menu, Wallet, Package } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DriverHeaderProps {
  title: string
  driverName?: string
  driverStatus?: 'AVAILABLE' | 'ON_DELIVERY' | 'OFFLINE'
  activeDeliveries?: number
  onLogout?: () => void
}

export function DriverHeader({
  title,
  driverName,
  driverStatus = 'OFFLINE',
  activeDeliveries = 0,
  onLogout
}: DriverHeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    if (onLogout) {
      onLogout()
    } else {
      await fetch('/api/driver-auth/logout', { method: 'POST' })
      router.push('/driver/login')
    }
  }

  const getStatusColor = () => {
    switch (driverStatus) {
      case 'AVAILABLE': return 'bg-green-500'
      case 'ON_DELIVERY': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusLabel = () => {
    switch (driverStatus) {
      case 'AVAILABLE': return 'Available'
      case 'ON_DELIVERY': return 'On Delivery'
      default: return 'Offline'
    }
  }

  return (
    <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
      <div className="px-4 py-3">
        {/* Top Row */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-semibold text-white">{title}</h1>
            {activeDeliveries !== undefined && (
              <p className="text-sm text-slate-400">{activeDeliveries} active</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/driver/cash-summary')}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <Wallet className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Badge */}
        {driverStatus && (
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            <span className="text-sm text-slate-400">{getStatusLabel()}</span>
          </div>
        )}
      </div>
    </header>
  )
}
