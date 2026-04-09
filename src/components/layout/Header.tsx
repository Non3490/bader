'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Bell, LogOut, User, Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import PusherClient, { type Channel } from 'pusher-js'

type Period = 'today' | '7d' | '30d' | 'custom'

interface HeaderProps {
  user: {
    id: string
    email: string
    name: string
    role: string
    phone?: string | null
  }
  sidebarCollapsed?: boolean
  onMobileMenuClick?: () => void
  period?: Period
  onPeriodChange?: (period: Period) => void
}

interface AppNotification {
  id: string
  title: string
  message: string
  type: string
  link?: string | null
  isRead: boolean
  createdAt: string
}

const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || ''
const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu'

export function Header({ user, sidebarCollapsed, onMobileMenuClick, period = '30d', onPeriodChange }: HeaderProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (user.role !== 'CALL_CENTER') return

    let active = true

    async function loadNotifications() {
      try {
        const response = await fetch('/api/notifications?limit=8', { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json()
        if (!active) return
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      } catch (error) {
        console.error('Failed to load notifications:', error)
      }
    }

    loadNotifications()
    const intervalId = window.setInterval(loadNotifications, 30000)

    let channel: Channel | null = null
    let client: PusherClient | null = null

    if (pusherKey) {
      client = new PusherClient(pusherKey, { cluster: pusherCluster })
      channel = client.subscribe(`agent-${user.id}`)
      channel.bind('new-notification', (notification: AppNotification) => {
        setNotifications((current) => [notification, ...current].slice(0, 8))
        setUnreadCount((current) => current + 1)
      })
    }

    return () => {
      active = false
      window.clearInterval(intervalId)
      if (channel) {
        channel.unbind('new-notification')
      }
      if (client) {
        client.unsubscribe(`agent-${user.id}`)
        client.disconnect()
      }
    }
  }, [user.id, user.role])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      // Hard redirect to clear all client state
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout error:', error)
      window.location.href = '/login'
    }
  }

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const handleNotificationClick = async (notification: AppNotification) => {
    try {
      if (!notification.isRead) {
        await fetch(`/api/notifications/${notification.id}/read`, { method: 'PATCH' })
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, isRead: true } : item))
        setUnreadCount((current) => Math.max(0, current - 1))
      }
      router.push(notification.link || '/call-center')
    } catch (error) {
      console.error('Failed to open notification:', error)
      router.push(notification.link || '/call-center')
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'PATCH' })
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-14 glass-topbar font-sora',
        'left-0 md:transition-[left] md:duration-300',
        sidebarCollapsed ? 'md:left-[70px]' : 'md:left-64'
      )}
    >
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-slate-400 hover:text-slate-900"
            onClick={onMobileMenuClick}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <span suppressHydrationWarning className="hidden lg:block border-r border-slate-200 pr-4 mr-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </span>

          {/* Date range selector */}
          {onPeriodChange && (
            <Select value={period} onValueChange={(value) => onPeriodChange(value as Period)}>
              <SelectTrigger className="h-8 w-[130px] text-[10px] font-bold uppercase tracking-wider rounded-lg border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#dc2626] px-1 text-[9px] font-bold text-white">
                    {Math.min(unreadCount, 9)}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[360px] rounded-xl p-0" align="end">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <DropdownMenuLabel className="p-0 text-[13px] font-bold text-[#111111]">Notifications</DropdownMenuLabel>
                {user.role === 'CALL_CENTER' && notifications.length > 0 ? (
                  <button type="button" onClick={handleMarkAllRead} className="text-[11px] font-semibold text-[#f07020]">
                    Mark all read
                  </button>
                ) : null}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {user.role !== 'CALL_CENTER' ? (
                  <div className="px-4 py-6 text-[12px] text-slate-500">App notifications are enabled for call center agents.</div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-6 text-[12px] text-slate-500">No notifications yet.</div>
                ) : notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-[#fff8f3]"
                  >
                    <span className={cn('mt-1 h-2 w-2 rounded-full', notification.isRead ? 'bg-slate-300' : 'bg-[#f07020]')} />
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-[12px] text-[#111111]', !notification.isRead && 'font-semibold')}>
                        {notification.message}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 overflow-hidden rounded-full p-0 ring-2 ring-slate-100 ring-offset-2 transition-all hover:scale-105 active:scale-95">
                <Avatar className="h-full w-full">
                  <AvatarFallback className="bg-[#f06a00] text-white font-bold text-[10px]">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive font-bold uppercase text-[10px] tracking-widest">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
