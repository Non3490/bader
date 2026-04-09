'use client'

import { useSoftphone } from './SoftphoneProvider'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ActiveCallPanel({
  customerName,
  phone,
  orderCode
}: {
  customerName: string
  phone: string
  orderCode: string
}) {
  const { callStatus, hangUp, callDuration } = useSoftphone()

  if (callStatus === 'idle') return null

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 shadow-xl border-green-500 bg-gradient-to-br from-green-50 to-green-100 z-50 animate-slide-up">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-green-600 p-2 rounded-full">
              <Phone className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Active Call</h3>
              <div className="text-2xl font-bold text-green-700">
                {formatDuration(callDuration)}
              </div>
            </div>
          </div>
          <Button
            onClick={hangUp}
            size="sm"
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            <PhoneOff className="h-4 w-4 mr-1" />
            Hang Up
          </Button>
        </div>

        {/* Customer Info */}
        <div className="space-y-3 mb-4 pb-4 border-b border-green-200">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Customer</p>
            <p className="font-semibold text-base">{customerName}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Phone</p>
              <p className="font-medium">{phone}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Order</p>
              <p className="font-mono text-sm">{orderCode}</p>
            </div>
          </div>
        </div>

        {/* Mute Toggle */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Mute microphone"
            title="Mute/Unmute microphone"
          >
            <Volume2 className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%),
            opacity: 0,
          },
          to {
            transform: translateY(0),
            opacity: 1,
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6) infinite;
        }
      `}</style>
    </Card>
  )
}
