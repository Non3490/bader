'use client'

/**
 * StatusButton Component
 * Large one-tap status change button
 * Minimum height: 56px for mobile usability
 */

import { ReactNode } from 'react'

interface StatusButtonProps {
  status: string
  label: string
  color: string
  icon?: ReactNode
  isLoading?: boolean
  onPress: () => void
}

export function StatusButton({
  label,
  color,
  icon,
  isLoading = false,
  onPress
}: StatusButtonProps) {
  const colorClasses: Record<string, string> = {
    yellow: 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700',
    purple: 'bg-purple-500 hover:bg-purple-600 active:bg-purple-700',
    green: 'bg-green-500 hover:bg-green-600 active:bg-green-700',
    red: 'bg-red-500 hover:bg-red-600 active:bg-red-700',
    blue: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700',
  }

  return (
    <button
      onClick={onPress}
      disabled={isLoading}
      className={`
        w-full h-14 rounded-xl font-semibold text-white
        transition-all disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center gap-2
        ${colorClasses[color] || colorClasses.blue}
      `}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </button>
  )
}
