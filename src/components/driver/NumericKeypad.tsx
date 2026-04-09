'use client'

/**
 * NumericKeypad Component
 * Reusable PIN entry keypad for driver login
 */

import { LogOut } from 'lucide-react'

interface NumericKeypadProps {
  value: string
  maxLength?: number
  isLoading?: boolean
  onDigit: (digit: string) => void
  onDelete: () => void
  onSubmit: () => void
}

export function NumericKeypad({
  value,
  maxLength = 6,
  isLoading = false,
  onDigit,
  onDelete,
  onSubmit
}: NumericKeypadProps) {
  const canSubmit = value.length >= 4 && !isLoading

  return (
    <div className="w-full max-w-xs grid grid-cols-3 gap-3">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
        <button
          key={digit}
          onClick={() => onDigit(digit.toString())}
          disabled={isLoading || value.length >= maxLength}
          className="h-16 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white text-2xl font-semibold rounded-xl border border-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          {digit}
        </button>
      ))}

      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="h-16 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl border border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation flex items-center justify-center"
      >
        {isLoading ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <LogOut className="w-6 h-6" />
        )}
      </button>

      <button
        onClick={() => onDigit('0')}
        disabled={isLoading || value.length >= maxLength}
        className="h-16 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white text-2xl font-semibold rounded-xl border border-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
      >
        0
      </button>

      <button
        onClick={onDelete}
        disabled={isLoading || value.length === 0}
        className="h-16 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-semibold rounded-xl border border-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
      >
        ⌫
      </button>
    </div>
  )
}
