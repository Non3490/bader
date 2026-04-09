import Pusher from 'pusher'

const pusherInstance = new Pusher({
  appId: process.env.PUSHER_APP_ID || '',
  key: process.env.PUSHER_KEY || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.PUSHER_CLUSTER || 'eu',
  useTLS: true
})

export const pusher = pusherInstance

// Queue updates channel - used for real-time call center queue updates
export const QUEUE_CHANNEL = 'queue-updates'

// Activity channel - used for admin dashboard activity feed
export const ACTIVITY_CHANNEL = 'activity-updates'

// Stock channel - used for low stock alerts and stock movements
export const STOCK_CHANNEL = 'stock-updates'

// Event types for queue updates
export const QUEUE_EVENTS = {
  ORDER_UPDATED: 'order-updated',
  ORDER_CREATED: 'order-created',
  ORDER_ASSIGNED: 'order-assigned',
  ORDER_LOCKED: 'order-locked',
  ORDER_UNLOCKED: 'order-unlocked',
  BUNDLE_DETECTED: 'bundle-detected'
} as const

// Event types for activity updates
export const ACTIVITY_EVENTS = {
  NEW_ACTIVITY: 'new-activity',
  ORDER_STATUS_CHANGED: 'order-status-changed',
  USER_LOGGED_IN: 'user-logged-in',
  USER_LOGGED_OUT: 'user-logged-out',
} as const

export const NOTIFICATION_EVENTS = {
  NEW_NOTIFICATION: 'new-notification',
} as const

// Event types for stock updates
export const STOCK_EVENTS = {
  LOW_STOCK_ALERT: 'low-stock-alert',
  STOCK_MOVEMENT: 'stock-movement',
  STOCK_TRANSFER: 'stock-transfer',
} as const

export type StockEventType = typeof STOCK_EVENTS[keyof typeof STOCK_EVENTS]

export type QueueEventType = typeof QUEUE_EVENTS[keyof typeof QUEUE_EVENTS]
export type ActivityEventType = typeof ACTIVITY_EVENTS[keyof typeof ACTIVITY_EVENTS]

// Broadcast low stock alert to seller
export async function broadcastLowStockAlert(data: {
  productId: string
  productName: string
  sku: string
  quantity: number
  threshold: number
  sellerId: string
  timestamp: string
}) {
  try {
    await pusher.trigger(`seller-${data.sellerId}`, STOCK_EVENTS.LOW_STOCK_ALERT, data)
    // Also broadcast to admin channel for monitoring
    await pusher.trigger(ACTIVITY_CHANNEL, STOCK_EVENTS.LOW_STOCK_ALERT, data)
  } catch (error) {
    console.error('[Pusher] Failed to broadcast low stock alert:', error)
  }
}

export async function broadcastAgentNotification(
  userId: string,
  data: {
    id: string
    title: string
    message: string
    type: string
    link?: string | null
    isRead: boolean
    createdAt: string
  }
) {
  try {
    await pusher.trigger(`agent-${userId}`, NOTIFICATION_EVENTS.NEW_NOTIFICATION, data)
  } catch (error) {
    console.error('[Pusher] Failed to broadcast agent notification:', error)
  }
}

// Broadcast order update to all connected call center agents
export async function broadcastOrderUpdate(
  eventType: QueueEventType,
  data: {
    orderId: string
    trackingNumber?: string
    status?: string
    sellerId?: string
    assignedAgentId?: string
    bundleGroupId?: string
    timestamp: string
  }
) {
  try {
    await pusher.trigger(QUEUE_CHANNEL, eventType, data)
  } catch (error) {
    console.error('[Pusher] Failed to broadcast order update:', error)
  }
}

// Broadcast bundle detection to all connected agents
export async function broadcastBundleDetection(
  data: {
    bundleGroupId: string
    orderCount: number
    customerPhone: string
    customerName: string
    totalCodAmount: number
    timestamp: string
  }
) {
  try {
    await pusher.trigger(QUEUE_CHANNEL, QUEUE_EVENTS.BUNDLE_DETECTED, data)
  } catch (error) {
    console.error('[Pusher] Failed to broadcast bundle detection:', error)
  }
}

// Broadcast activity to admin dashboard
export async function broadcastActivity(
  eventType: ActivityEventType,
  data: {
    type: string
    description: string
    userId?: string
    userName?: string
    orderId?: string
    timestamp: string
  }
) {
  try {
    await pusher.trigger(ACTIVITY_CHANNEL, ACTIVITY_EVENTS.NEW_ACTIVITY, {
      eventType,
      ...data,
    })
  } catch (error) {
    console.error('[Pusher] Failed to broadcast activity:', error)
  }
}
