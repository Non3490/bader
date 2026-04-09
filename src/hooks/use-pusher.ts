'use client'

import { useEffect, useState } from 'react'
import Pusher from 'pusher-js'

export interface UsePusherOptions {
  channelName: string
  eventName: string
}

export function usePusher<T = any>({ channelName, eventName }: UsePusherOptions) {
  const [data, setData] = useState<T | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Only initialize on client
    if (typeof window === 'undefined') return

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER || 'eu'

    if (!pusherKey) {
      console.warn('[usePusher] PUSHER_KEY not configured')
      return
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
      useTLS: true,
    })

    const channel = pusher.subscribe(channelName)

    channel.bind(eventName, (newData: T) => {
      setData(newData)
    })

    pusher.connection.bind('connected', () => {
      setIsConnected(true)
    })

    pusher.connection.bind('disconnected', () => {
      setIsConnected(false)
    })

    return () => {
      channel.unbind(eventName)
      channel.unsubscribe()
      pusher.disconnect()
    }
  }, [channelName, eventName])

  return { data, isConnected }
}
