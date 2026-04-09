'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet'
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { roleLabels, type UserRole } from '@/types/auth-types'
import {
  NAV_PINNED,
  NAV_GROUPS,
  CALL_CENTER_NAV,
  CALL_CENTER_GROUPS,
  DELIVERY_NAV,
  DELIVERY_GROUPS,
  SELLER_NAV,
  SELLER_GROUPS,
  type NavItem,
  type NavGroup,
} from '@/config/nav'

interface SidebarProps {
  user: {
    id: string
    email: string
    name: string
    role: UserRole
    phone?: string | null
  }
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  mobileSidebarOpen?: boolean
  onMobileSidebarOpenChange?: (open: boolean) => void
  orderCount?: number
}

interface CallCenterSidebarStats {
  totalCalls: number
  confirmed: number
  cancelled: number
}

interface DeliverySidebarStats {
  delivered: number
  returned: number
  cashCollected: number
  pending: number
}

type AgentStatsUpdatedDetail = {
  totalCalls: number
  confirmed: number
  cancelled: number
}

// Get navigation items based on user role
function getNavItemsForRole(role: UserRole): { pinned: NavItem[]; groups: NavGroup[] } {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return { pinned: NAV_PINNED, groups: NAV_GROUPS }
    case 'CALL_CENTER':
      return { pinned: CALL_CENTER_NAV, groups: CALL_CENTER_GROUPS }
    case 'DELIVERY':
      return { pinned: DELIVERY_NAV, groups: DELIVERY_GROUPS }
    case 'SELLER':
      return { pinned: SELLER_NAV, groups: SELLER_GROUPS }
    default:
      return { pinned: [], groups: [] }
  }
}

// ─── Shared nav content (used by both desktop sidebar + mobile sheet) ───────

interface NavContentProps {
  user: SidebarProps['user']
  collapsed: boolean
  onCollapsedChange: (v: boolean) => void
  onNavClick?: () => void
  orderCount?: number
}

function NavContent({ user, collapsed, onCollapsedChange, onNavClick, orderCount = 0 }: NavContentProps) {
  const pathname = usePathname()
  const [callCenterStats, setCallCenterStats] = useState<CallCenterSidebarStats>({
    totalCalls: 0,
    confirmed: 0,
    cancelled: 0,
  })
  const [deliveryStats, setDeliveryStats] = useState<DeliverySidebarStats>({
    delivered: 0,
    returned: 0,
    cashCollected: 0,
    pending: 0,
  })

  const { pinned, groups } = getNavItemsForRole(user.role)

  // Default open state for groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    groups.forEach((group) => {
      // Operations group is open by default for ADMIN
      initial[group.key] = group.key === 'operations'
    })
    return initial
  })

  // Auto-open group if current route is inside it (exclusive - only one group open)
  useEffect(() => {
    const allKeys = groups.map(g => g.key)
    // Find the group that contains the current route
    const activeGroupKey = groups.find((group) =>
      group.children.some((child) =>
        pathname === child.href || (child.href !== '/' && pathname.startsWith(child.href + '/'))
      )
    )?.key

    // Close all groups, then open only the active one
    const closedAll = allKeys.reduce((acc, k) => ({ ...acc, [k]: false }), {})
    setOpenGroups({ ...closedAll, [activeGroupKey || '']: !!activeGroupKey })
  }, [pathname, groups])

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const isCurrentlyOpen = prev[key]
      // Close all groups, then toggle the clicked one
      const closedAll = Object.keys(prev).reduce((acc, k) => ({ ...acc, [k]: false }), {})
      return { ...closedAll, [key]: !isCurrentlyOpen }
    })
  }

  const isActive = (href: string) => {
    return pathname === href || (href !== '/' && pathname.startsWith(href + '/'))
  }

  const isGroupActive = (group: NavGroup) => {
    return group.children.some((child) => isActive(child.href))
  }

  const userInitials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Load call center stats
  useEffect(() => {
    if (user.role !== 'CALL_CENTER') return

    let active = true

    async function loadStats() {
      try {
        const res = await fetch('/api/call-logs', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (active && data?.stats) {
          setCallCenterStats({
            totalCalls: data.stats.totalCalls ?? 0,
            confirmed: data.stats.confirmed ?? 0,
            cancelled: data.stats.cancelled ?? 0,
          })
        }
      } catch (error) {
        console.error('Failed to load call center sidebar stats:', error)
      }
    }

    loadStats()
    const handleStatsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<AgentStatsUpdatedDetail>).detail
      if (!detail || !active) return
      setCallCenterStats({
        totalCalls: detail.totalCalls ?? 0,
        confirmed: detail.confirmed ?? 0,
        cancelled: detail.cancelled ?? 0,
      })
    }

    window.addEventListener('agent-stats-updated', handleStatsUpdated as EventListener)
    const intervalId = window.setInterval(loadStats, 30000)
    return () => {
      active = false
      window.removeEventListener('agent-stats-updated', handleStatsUpdated as EventListener)
      window.clearInterval(intervalId)
    }
  }, [user.role])

  // Load delivery stats
  useEffect(() => {
    if (user.role !== 'DELIVERY') return

    let active = true

    async function loadStats() {
      try {
        const res = await fetch('/api/delivery/today', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (active && data?.stats) {
          setDeliveryStats({
            delivered: data.stats.delivered ?? 0,
            returned: data.stats.returned ?? 0,
            cashCollected: data.stats.cashCollected ?? 0,
            pending: data.stats.assigned ?? 0,
          })
        }
      } catch (error) {
        console.error('Failed to load delivery sidebar stats:', error)
      }
    }

    loadStats()
    const intervalId = window.setInterval(loadStats, 30000)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [user.role])

  const dailyTarget = 56
  const confirmRate =
    callCenterStats.confirmed + callCenterStats.cancelled > 0
      ? Math.round((callCenterStats.confirmed / (callCenterStats.confirmed + callCenterStats.cancelled)) * 100)
      : 0
  const progress = Math.min(100, Math.round((callCenterStats.totalCalls / dailyTarget) * 100))

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div
        className={cn(
          'flex h-16 items-center px-4 mb-2 shrink-0 font-sora',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-0.5">
              <span className="text-orange-600 font-extrabold text-lg italic">E-</span>
              <span className="text-white font-extrabold text-lg tracking-tight">Gabon</span>
            </div>
          </div>
        )}
        {collapsed && (
          <button
            onClick={() => onCollapsedChange(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 shadow-md hover:bg-orange-500 transition cursor-pointer"
          >
            <ChevronRight className="h-4 w-4 text-white" />
          </button>
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCollapsedChange(true)}
            className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!collapsed && (
        <div className="px-4 -mt-3 mb-4">
          <span className="ml-[2px] block text-[9px] font-bold uppercase tracking-[0.3em] text-[#f06a00]">
            Prime
          </span>
        </div>
      )}

      {/* Nav */}
      <div className="flex-1 px-3 overflow-y-auto overflow-x-hidden">
        <div className={cn('py-2', groups.length > 0 && 'space-y-1')}>
          {/* Pinned items */}
          {pinned.map((item) => (
            <NavItemComponent
              key={item.href}
              item={item}
              active={isActive(item.href)}
              collapsed={collapsed}
              badge={item.label === 'Orders' ? orderCount : item.badge}
              onClick={onNavClick}
            />
          ))}

          {/* Divider if we have groups */}
          {groups.length > 0 && pinned.length > 0 && !collapsed && (
            <div className="h-px bg-white/7 my-3 mx-2" />
          )}

          {/* Collapsible groups */}
          {groups.map((group) => (
            <NavGroupComponent
              key={group.key}
              group={group}
              isOpen={openGroups[group.key]}
              isGroupActive={isGroupActive(group)}
              onToggle={() => toggleGroup(group.key)}
              pathname={pathname}
              collapsed={collapsed}
            />
          ))}
        </div>
      </div>

      {/* Performance & User card */}
      <div className="mt-auto flex flex-col gap-4 p-4 shrink-0">
        {!collapsed && user.role === 'CALL_CENTER' && (
          <div className="bg-[#f06a00]/10 border border-[#f06a00]/20 rounded-xl p-3 font-sora">
            <h4 className="text-[8px] font-bold text-white/30 uppercase tracking-widest mb-2">
              My Performance Today
            </h4>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-white/40">Calls made</span>
              <span className="text-white/80 font-bold">
                {callCenterStats.totalCalls} / {dailyTarget}
              </span>
            </div>
            <div className="flex justify-between text-[10px] mb-2">
              <span className="text-white/40">Confirm rate</span>
              <span className="text-white/80 font-bold">{confirmRate}%</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-[#f06a00]" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}

        {!collapsed && user.role === 'DELIVERY' && (
          <div className="bg-[#f06a00]/10 border border-[#f06a00]/20 rounded-xl p-3 font-sora">
            <h4 className="text-[8px] font-bold text-white/30 uppercase tracking-widest mb-2">
              My Performance Today
            </h4>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-white/40">Delivered</span>
              <span className="text-white/80 font-bold">
                {deliveryStats.delivered} / 30
              </span>
            </div>
            <div className="flex justify-between text-[10px] mb-2">
              <span className="text-white/40">Success rate</span>
              <span className="text-white/80 font-bold">
                {deliveryStats.delivered + deliveryStats.returned > 0
                  ? Math.round((deliveryStats.delivered / (deliveryStats.delivered + deliveryStats.returned)) * 100)
                  : 0}%
              </span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#f06a00]"
                style={{ width: `${Math.min(100, (deliveryStats.delivered / 30) * 100)}%` }}
              ></div>
            </div>
          </div>
        )}

        <div
          className={cn(
            'pt-4 border-t border-white/5',
            collapsed ? 'flex justify-center' : ''
          )}
        >
          {!collapsed ? (
            <div className="flex items-center gap-3 group cursor-default">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f06a00] text-white font-bold text-xs shadow-sm">
                {userInitials}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <p className="text-sm font-semibold truncate text-white leading-none mb-1.5">
                  {user.name}
                </p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f06a00] animate-pulse"></div>
                  <span className="text-[8px] font-bold uppercase tracking-widest text-[#f06a00]">
                    {roleLabels[user.role]}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full bg-[#f06a00] flex items-center justify-center text-white text-xs font-bold shadow-md">
              {userInitials}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Nav Item Component ───────────────────────────────────────────────────────

interface NavItemComponentProps {
  item: NavItem
  active: boolean
  collapsed: boolean
  badge?: number
  onClick?: () => void
}

function NavItemComponent({ item, active, collapsed, badge, onClick }: NavItemComponentProps) {
  const Icon = item.icon

  if (collapsed) {
    return (
      <Link href={item.href} onClick={onClick}>
        <div
          className={cn(
            'group relative flex items-center justify-center rounded-md px-0 py-2 transition-all duration-200 cursor-pointer h-10 w-10 mx-auto',
            active
              ? 'bg-[#f06a00] text-white shadow-[0_2px_10px_rgba(240,106,0,0.28)]'
              : 'text-white/40 hover:bg-white/5 hover:text-white/80'
          )}
          title={item.label}
        >
          {Icon && <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />}
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/18 text-[10px] font-bold text-white">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
          <div className="sr-only">{item.label}</div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={item.href} onClick={onClick} className="block">
      <div
        className={cn(
          'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 cursor-pointer',
          active
            ? 'bg-[#f06a00] text-white font-bold shadow-[0_2px_10px_rgba(240,106,0,0.28)]'
            : 'text-white/40 hover:bg-white/5 hover:text-white/80'
        )}
      >
        <div className="transition-transform duration-200 group-hover:scale-110">
          {Icon && <Icon className="h-4 w-4" />}
        </div>
        <span className="flex-1 truncate">{item.label}</span>
        {badge !== undefined && badge > 0 && (
          <span
            className={cn(
              'flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 min-w-[18px]',
              active ? 'bg-white/28 text-white' : 'bg-white/18 text-white'
            )}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
    </Link>
  )
}

// ─── Nav Group Component ───────────────────────────────────────────────────────

interface NavGroupComponentProps {
  group: NavGroup
  isOpen: boolean
  isGroupActive: boolean
  onToggle: () => void
  pathname: string
  collapsed: boolean
}

function NavGroupComponent({
  group,
  isOpen,
  isGroupActive,
  onToggle,
  pathname,
  collapsed,
}: NavGroupComponentProps) {
  const Icon = group.icon

  // In collapsed mode, don't show the group at all (could be enhanced to show a tooltip)
  if (collapsed) {
    return null
  }

  return (
    <div className="space-y-1">
      <button
        onClick={onToggle}
        className={cn(
          'group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 cursor-pointer',
          isOpen ? 'text-white' : 'text-white/40 hover:bg-white/5 hover:text-white/80',
          !isOpen && isGroupActive && 'text-[#f06a00]'
        )}
      >
        <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
        <span className="flex-1 truncate">{group.label}</span>
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 opacity-50 transition-transform duration-200',
            isOpen && 'rotate-90'
          )}
        />
      </button>

      {/* Collapsible content with smooth animation */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="space-y-[2px] py-1">
          {group.children.map((child) => {
            const isActive = pathname === child.href || (child.href !== '/' && pathname.startsWith(child.href + '/'))
            return (
              <Link key={child.href} href={child.href} className="block">
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer',
                    isActive
                      ? 'text-[#f06a00] font-semibold'
                      : 'text-white/30 hover:bg-white/5 hover:text-white/60'
                  )}
                >
                  <span className="w-4" /> {/* Spacer for icon alignment */}
                  <span className="flex-1 truncate">{child.label}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main Sidebar export ─────────────────────────────────────────────────────

export function Sidebar({
  user,
  collapsed,
  onCollapsedChange,
  mobileSidebarOpen = false,
  onMobileSidebarOpenChange,
  orderCount,
}: SidebarProps) {
  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside
        className={cn(
          'hidden md:flex fixed left-0 top-0 z-40 h-screen border-r border-white/10 bg-[#111111] transition-all duration-300 ease-in-out flex-col',
          collapsed ? 'w-[70px]' : 'w-64'
        )}
      >
        <NavContent
          user={user}
          collapsed={collapsed}
          onCollapsedChange={onCollapsedChange}
          orderCount={orderCount}
        />
      </aside>

      {/* ── Mobile sidebar (Sheet, visible on mobile only) ── */}
      <Sheet open={mobileSidebarOpen} onOpenChange={onMobileSidebarOpenChange}>
        <SheetContent side="left" className="p-0 w-72 md:hidden">
          <NavContent
            user={user}
            collapsed={false}
            onCollapsedChange={() => {}}
            onNavClick={() => onMobileSidebarOpenChange?.(false)}
            orderCount={orderCount}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
