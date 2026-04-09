'use client'

import { ReactNode } from 'react'
import { Bell, Calendar } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface TopBarProps {
  title: string
  actions?: ReactNode
  user?: {
    name: string
    email: string
    avatar?: string
  }
}

export function TopBar({ title, actions, user }: TopBarProps) {
  const today = format(new Date(), 'EEE, dd MMM yyyy', { locale: fr })

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <header className="fixed top-0 right-0 z-30 h-[54px] bg-white/90 backdrop-blur-xl border-b border-orange/10 flex justify-between items-center px-6 font-sora">
      <div className="flex items-center gap-4">
        <h1 className="text-[13.5px] font-bold text-text-primary tracking-tight">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-6">
        {/* Date */}
        <span className="hidden lg:block text-text-secondary text-[10px] font-bold uppercase tracking-widest">
          {today}
        </span>

        {/* Action Icons */}
        <div className="flex items-center gap-3">
          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f8f8f8] transition-colors text-text-secondary">
            <Bell className="w-[18px] h-[18px]" />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f8f8f8] transition-colors text-text-secondary">
            <Calendar className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Custom Actions */}
        {actions}

        {/* User Avatar */}
        {user && (
          <Avatar className="w-8 h-8 border border-border">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} />
            ) : (
              <AvatarFallback className="bg-orange text-white text-[10px] font-bold">
                {getInitials(user.name)}
              </AvatarFallback>
            )}
          </Avatar>
        )}
      </div>
    </header>
  )
}
