'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Phone,
  FileText,
  ClipboardList,
  CreditCard,
  DollarSign
} from 'lucide-react'

interface SidebarNavProps {
  currentPage: 'overview' | 'call-center' | 'log-expense'
}

interface NavItemProps {
  icon: React.ReactNode
  label: string
  href: string
  badge?: number
  isActive?: boolean
}

function NavItem({ icon, label, href, badge, isActive }: NavItemProps) {
  return (
    <a
      href={href}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
        'hover:bg-white/5 dark:hover:bg-white/10',
        isActive && 'bg-white dark:bg-white/5 shadow-md border-2',
        !isActive && 'hover:border-white/20 dark:hover:border-white/10 border-transparent'
      )}
    >
      <div className={cn('text-gray-600 dark:text-gray-300', isActive && 'text-primary dark:text-primary')}>
        {icon}
        <span className="flex-1">{label}</span>
        {badge !== undefined && (
          <span className="ml-auto bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
    </a>
  )
}

export function SidebarNav({ currentPage }: SidebarNavProps) {
  return (
    <div className="w-full h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-orange-600 dark:text-orange-400 font-extrabold text-xl font-bold tracking-tight">
              E-Gabon
            </span>
            <span className="text-gray-600 dark:text-gray-300 font-semibold text-lg">
              Prime
            </span>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            COD Fulfillment Dashboard
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="bg-gradient-to-br from-primary to-primary/10 via-transparent px-6 py-4">
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Calls Today</p>
                <p className="text-2xl font-bold text-white">86</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Confirm Rate</p>
                <p className="text-2xl font-bold text-white">53%</p>
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pending Calls</p>
                  <div className="h-2 w-24 bg-gray-200 dark:bg-gray-700 rounded-full relative overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: '53%' }} />
                  </div>
                  <p className="text-lg font-bold text-white">5</p>
                </div>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Calls</p>
              <p className="text-2xl font-bold text-white">30</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <nav className="space-y-1">
          <NavItem
            icon={<LayoutDashboard />}
            label="Overview"
            href="/dashboard"
            isActive={currentPage === 'overview'}
          />
          <NavItem
            icon={<Phone className="h-5 w-5" />}
            label="Call Center"
            href="/call-center"
            isActive={currentPage === 'call-center'}
          />
          <NavItem
            icon={<ClipboardList />}
            label="Log Expense"
            href="/call-center/expense"
            isActive={currentPage === 'log-expense'}
          />
        </nav>
      </div>
    </div>
  )
}
