'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { format, subDays, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'

export type PeriodValue = 'today' | '7d' | '30d' | '90d' | 'custom'

interface DateRange {
  from: Date
  to: Date
}

interface PeriodSelectorProps {
  value: PeriodValue
  customRange?: DateRange
  onChange: (period: PeriodValue, range?: DateRange) => void
  showCompare?: boolean
  compareEnabled?: boolean
  onCompareToggle?: (enabled: boolean) => void
}

const PERIODS = [
  { value: 'today' as const, label: "Aujourd'hui" },
  { value: '7d' as const, label: '7 jours' },
  { value: '30d' as const, label: '30 jours' },
  { value: '90d' as const, label: '90 jours' },
  { value: 'custom' as const, label: 'Personnalisé' },
]

function getPeriodLabel(period: PeriodValue, range?: DateRange): string {
  if (period === 'custom' && range) {
    return `${format(range.from, 'd MMM', { locale: fr })} – ${format(range.to, 'd MMM yyyy', { locale: fr })}`
  }
  return PERIODS.find(p => p.value === period)?.label || period
}

export function PeriodSelector({
  value,
  customRange,
  onChange,
  showCompare = false,
  compareEnabled = false,
  onCompareToggle,
}: PeriodSelectorProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [tempRange, setTempRange] = useState<Partial<DateRange>>({})

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Period buttons */}
      <div className="flex items-center rounded-lg border border-[#e5e5e5] bg-white p-1 gap-1">
        {PERIODS.filter(p => p.value !== 'custom').map(period => (
          <button
            key={period.value}
            onClick={() => onChange(period.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              value === period.value
                ? 'bg-[#f07020] text-white'
                : 'text-[#555] hover:bg-[#f8f8f8]'
            }`}
          >
            {period.label}
          </button>
        ))}

        {/* Custom date range picker */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                value === 'custom'
                  ? 'bg-[#f07020] text-white'
                  : 'text-[#555] hover:bg-[#f8f8f8]'
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              {value === 'custom' && customRange
                ? getPeriodLabel('custom', customRange)
                : 'Personnalisé'}
              <ChevronDown className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="end">
            <div className="text-xs text-[#555] mb-2 font-medium">Sélectionner une période</div>
            <Calendar
              mode="range"
              selected={tempRange as any}
              onSelect={(range: any) => {
                if (range?.from && range?.to) {
                  onChange('custom', { from: range.from, to: range.to })
                  setCalendarOpen(false)
                } else {
                  setTempRange(range || {})
                }
              }}
              disabled={{ after: new Date() }}
              locale={fr}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Compare toggle */}
      {showCompare && onCompareToggle && (
        <button
          onClick={() => onCompareToggle(!compareEnabled)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
            compareEnabled
              ? 'border-[#f07020] bg-[#fff4e6] text-[#f07020]'
              : 'border-[#e5e5e5] bg-white text-[#555] hover:border-[#d4d4d4]'
          }`}
        >
          Comparer période précédente
        </button>
      )}
    </div>
  )
}
