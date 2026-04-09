'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { GlobalLowStockBanner } from '@/components/inventory/GlobalLowStockBanner'
import { cn } from '@/lib/utils'
import { type UserRole } from '@/types/auth-types'

type Period = 'today' | '7d' | '30d' | 'custom'

interface DashboardStats {
  pendingOrders?: number
  newOrders?: number
  confirmedOrders?: number
  totalOrders?: number
}

interface DashboardLayoutProps {
  children: React.ReactNode
  user: {
    id: string
    email: string
    name: string
    role: UserRole
    phone?: string | null
  }
  period?: Period
  onPeriodChange?: (period: Period) => void
}

export function DashboardLayout({ children, user, period, onPeriodChange }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [orderCount, setOrderCount] = useState(0)

  // Fetch pending order count for the badge
  useEffect(() => {
    async function fetchOrderCount() {
      try {
        const res = await fetch('/api/dashboard?period=today', {
          cache: 'no-store'
        })
        if (res.ok) {
          const data = await res.json()
          // Use pendingOrders (new + confirmed) for the badge
          setOrderCount(data.stats?.pendingOrders || 0)
        }
      } catch (error) {
        console.error('Failed to fetch order count:', error)
      }
    }

    fetchOrderCount()

    // Refresh order count every 30 seconds
    const intervalId = setInterval(fetchOrderCount, 30000)
    return () => clearInterval(intervalId)
  }, [])

  return (
    <div className="min-h-screen bg-background font-sora">
      <Sidebar
        user={user}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        mobileSidebarOpen={mobileSidebarOpen}
        onMobileSidebarOpenChange={setMobileSidebarOpen}
        orderCount={orderCount}
      />
      {/* Content shifts right on desktop only */}
      <div
        className={cn(
          'transition-all duration-300 min-h-screen',
          sidebarCollapsed ? 'md:ml-[70px]' : 'md:ml-64'
        )}
      >
        <Header
          user={user}
          sidebarCollapsed={sidebarCollapsed}
          onMobileMenuClick={() => setMobileSidebarOpen(true)}
          period={period}
          onPeriodChange={onPeriodChange}
        />
        <GlobalLowStockBanner userRole={user.role} userId={user.id} />
        <main className="px-4 pb-4 pt-14 md:px-6 md:pb-6 md:pt-14">
          {children}
        </main>
      </div>
    </div>
  )
}
