'use client'

import { useSoftphone } from './SoftphoneProvider'
import { Button } from '@/components/ui/button'
import { Phone, PhoneOff } from 'lucide-react'

interface CallButtonProps {
  phone: string
  orderId: string
  disabled?: boolean
  size?: 'default' | 'sm' | 'icon'
}

export function CallButton({ phone, orderId, disabled: externalDisabled = false, size = 'sm' }: CallButtonProps) {
  const { callStatus, makeCall } = useSoftphone()

  const handleCall = () => {
    makeCall(phone, orderId)
  }

  const isDisabled = externalDisabled || callStatus !== 'idle'

  return (
    <Button
      onClick={handleCall}
      disabled={isDisabled}
      size={size}
      className={
        callStatus === 'idle'
          ? 'bg-green-600 hover:bg-green-700 text-white'
          : 'bg-gray-500 text-white cursor-not-allowed'
      }
      title={isDisabled ? callStatus === 'connecting' ? 'Connecting...' : 'Call in progress' : 'Make call'}
      aria-label={size === 'icon'
        ? (isDisabled
            ? (callStatus === 'connecting' ? 'Connecting...' : 'Call in progress')
            : `Call ${phone}`)
        : undefined
      }
    >
      {callStatus === 'idle' ? (
        <Phone className="h-4 w-4 mr-1" aria-hidden={size !== 'icon'} />
      ) : (
        <PhoneOff className="h-4 w-4 mr-1" aria-hidden={size !== 'icon'} />
      )}
      {size !== 'icon' && 'Call'}
    </Button>
  )
}
