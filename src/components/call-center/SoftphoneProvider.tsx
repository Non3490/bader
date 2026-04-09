'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Device } from '@twilio/voice-sdk'
import { toast } from 'sonner'

interface SoftphoneContextType {
  device: Device | null
  callStatus: 'idle' | 'connecting' | 'ringing' | 'connected' | 'error'
  makeCall: (phone: string, orderId: string) => Promise<void>
  hangUp: () => void
  callDuration: number
  twilioConfigured: boolean
}

const SoftphoneContext = createContext<SoftphoneContextType | undefined>(undefined)

interface Call {
  orderId: string
  phone: string
  startTime: number
}

export function SoftphoneProvider({ children }: { children: React.ReactNode }) {
  const [device, setDevice] = useState<Device | null>(null)
  const [callStatus, setCallStatus] = useState<SoftphoneContextType['callStatus']>('idle')
  const [callDuration, setCallDuration] = useState(0)
  const [currentCall, setCurrentCall] = useState<Call | null>(null)
  const [tokenError, setTokenError] = useState(false)
  const [twilioConfigured, setTwilioConfigured] = useState(true)

  // Timer for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (callStatus === 'connected' && currentCall) {
      interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - currentCall.startTime) / 1000))
      }, 1000)
    } else {
      setCallDuration(0)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [callStatus, currentCall])

  const initDevice = useCallback(async () => {
    try {
      const res = await fetch('/api/twilio/token')

      // Twilio is not configured — skip silently, no error shown to user
      if (res.status === 503) {
        setTwilioConfigured(false)
        return
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to get token')
      }

      const { token } = await res.json()
      setTwilioConfigured(true)

      const newDevice = new Device(token, {
        codecPreferences: ['opus', 'pcmu'],
        enableImprovedNoiseCancellation: true,
        enableRtcEnhancements: true
      })

      newDevice.on('ready', () => {
        console.log('Twilio Device ready')
        setTokenError(false)
      })

      newDevice.on('error', (error) => {
        console.error('Twilio Device error:', error)
        toast.error('Device connection error')
        setCallStatus('error')
      })

      newDevice.on('offline', () => {
        console.log('Twilio Device offline')
        toast.warning('Device went offline')
      })

      newDevice.on('incoming', (call) => {
        console.log('Incoming call:', call)
        setCallStatus('ringing')
      })

      newDevice.on('accept', (conn) => {
        console.log('Call accepted:', conn)
        setCallStatus('connected')
      })

      newDevice.on('disconnect', (conn) => {
        console.log('Call disconnected:', conn)
        setCallStatus('idle')
        setCurrentCall(null)
      })

      await newDevice.register()
      setDevice(newDevice)
      setCallStatus('idle')
    } catch (error) {
      console.error('Failed to initialize device:', error)
      setTokenError(true)
      toast.error('Failed to initialize softphone')
    }
  }, [])

  const makeCall = useCallback(async (phone: string, orderId: string) => {
    if (!device) {
      toast.error('Device not ready')
      return
    }

    if (callStatus !== 'idle') {
      toast.warning('Another call is in progress')
      return
    }

    try {
      // Create recording entry
      await fetch('/api/twilio/call/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, phoneNumber: phone })
      })

      setCallStatus('connecting')

      // Make the call using Twilio Device
      const conn = await device.connect({
        params: { To: phone.startsWith('+') ? phone : `+212${phone}` } // Add Morocco country code
      })

      setCurrentCall({
        orderId,
        phone,
        startTime: Date.now()
      })

      conn.on('accept', () => {
        setCallStatus('connected')
      })

      conn.on('disconnect', () => {
        setCallStatus('idle')
        setCurrentCall(null)
      })

      toast.success(`Calling ${phone}...`)
    } catch (error) {
      console.error('Failed to make call:', error)
      setCallStatus('error')
      toast.error('Failed to make call')
    }
  }, [device, callStatus])

  const hangUp = useCallback(() => {
    if (device) {
      device.disconnectAll()
      setCallStatus('idle')
      setCurrentCall(null)
    }
  }, [device])

  // Initialize device on mount
  useEffect(() => {
    initDevice()
    // Refresh token every 50 minutes
    const interval = setInterval(initDevice, 50 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <SoftphoneContext.Provider value={{ device, callStatus, makeCall, hangUp, callDuration, twilioConfigured }}>
      {children}
    </SoftphoneContext.Provider>
  )
}

export const useSoftphone = () => {
  const context = useContext(SoftphoneContext)
  if (!context) {
    throw new Error('useSoftphone must be used within SoftphoneProvider')
  }
  return context
}
