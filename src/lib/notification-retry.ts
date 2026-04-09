import { db } from '@/lib/db'

// Note: This model needs to be added to schema.prisma
/*
model FailedNotification {
  id              String   @id @default(cuid())
  recipient       String   // Phone number or email
  channel         String   // "sms" | "email" | "whatsapp"
  templateType    String?  // ORDER_CONFIRMED, etc.
  message         String   // The message that failed to send
  error           String   // Error message from the provider
  retryCount      Int      @default(0)
  maxRetries      Int      @default(3)
  nextRetryAt     DateTime // When to retry next
  lastAttemptAt   DateTime @default(now())
  status          String   @default("pending") // "pending" | "retrying" | "failed" | "sent"
  metadata        String?  // JSON string with additional context (orderId, etc.)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([status, nextRetryAt])
  @@index([channel])
  @@index([createdAt(sort: Desc)])
}
*/

export interface FailedNotificationData {
  recipient: string
  channel: 'sms' | 'email' | 'whatsapp'
  templateType?: string
  message: string
  error: string
  metadata?: Record<string, unknown>
}

// Retry schedule with exponential backoff (in minutes)
const RETRY_SCHEDULE = [1, 5, 15] // 1min, 5min, 15min
const MAX_RETRIES = 3

/**
 * Add a failed notification to the retry queue
 */
export async function enqueueFailedNotification(
  data: FailedNotificationData
): Promise<void> {
  try {
    const nextRetryAt = new Date(Date.now() + RETRY_SCHEDULE[0] * 60 * 1000)

    // Check if the model exists
    const hasModel = await checkFailedNotificationModel()

    if (!hasModel) {
      // Log to console if model doesn't exist yet
      console.error('[FailedNotification]', {
        ...data,
        retryCount: 0,
        nextRetryAt: nextRetryAt.toISOString()
      })
      return
    }

    await db.failedNotification.create({
      data: {
        recipient: data.recipient,
        channel: data.channel,
        templateType: data.templateType,
        message: data.message,
        error: data.error,
        retryCount: 0,
        maxRetries: MAX_RETRIES,
        nextRetryAt,
        status: 'pending',
        metadata: data.metadata ? JSON.stringify(data.metadata) : null
      }
    })
  } catch (error) {
    console.error('Failed to enqueue notification:', error)
  }
}

/**
 * Get all failed notifications that are ready for retry
 */
export async function getPendingRetries(limit = 50): Promise<Array<{
  id: string
  recipient: string
  channel: string
  message: string
  retryCount: number
  metadata: Record<string, unknown> | null
}>> {
  const hasModel = await checkFailedNotificationModel()

  if (!hasModel) {
    return []
  }

  const notifications = await db.failedNotification.findMany({
    where: {
      status: {
        in: ['pending', 'retrying']
      },
      nextRetryAt: {
        lte: new Date()
      }
    },
    take: limit,
    orderBy: {
      nextRetryAt: 'asc'
    }
  })

  return notifications.map(n => ({
    id: n.id,
    recipient: n.recipient,
    channel: n.channel,
    message: n.message,
    retryCount: n.retryCount,
    metadata: n.metadata ? JSON.parse(n.metadata) : null
  }))
}

/**
 * Mark a notification as successfully sent
 */
export async function markNotificationSent(notificationId: string): Promise<void> {
  const hasModel = await checkFailedNotificationModel()

  if (!hasModel) {
    return
  }

  await db.failedNotification.update({
    where: { id: notificationId },
    data: {
      status: 'sent',
      updatedAt: new Date()
    }
  })
}

/**
 * Mark a notification retry as failed and schedule next retry
 */
export async function markNotificationFailed(
  notificationId: string,
  error: string
): Promise<void> {
  const hasModel = await checkFailedNotificationModel()

  if (!hasModel) {
    return
  }

  const notification = await db.failedNotification.findUnique({
    where: { id: notificationId }
  })

  if (!notification) {
    return
  }

  const retryCount = notification.retryCount + 1

  if (retryCount >= notification.maxRetries) {
    // Max retries reached, mark as permanently failed
    await db.failedNotification.update({
      where: { id: notificationId },
      data: {
        status: 'failed',
        retryCount,
        error,
        updatedAt: new Date()
      }
    })
  } else {
    // Schedule next retry
    const nextRetryMinutes = RETRY_SCHEDULE[Math.min(retryCount, RETRY_SCHEDULE.length - 1)]
    const nextRetryAt = new Date(Date.now() + nextRetryMinutes * 60 * 1000)

    await db.failedNotification.update({
      where: { id: notificationId },
      data: {
        retryCount,
        error,
        nextRetryAt,
        status: 'retrying',
        lastAttemptAt: new Date(),
        updatedAt: new Date()
      }
    })
  }
}

/**
 * Get failed notifications for dashboard display
 */
export async function getFailedNotifications(params: {
  channel?: string
  status?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}) {
  const hasModel = await checkFailedNotificationModel()

  if (!hasModel) {
    return { notifications: [], total: 0 }
  }

  const where: Record<string, unknown> = {}

  if (params.channel) {
    where.channel = params.channel
  }

  if (params.status) {
    where.status = params.status
  }

  if (params.startDate || params.endDate) {
    where.createdAt = {}
    if (params.startDate) {
      (where.createdAt as Record<string, unknown>).gte = params.startDate
    }
    if (params.endDate) {
      (where.createdAt as Record<string, unknown>).lte = params.endDate
    }
  }

  const [notifications, total] = await Promise.all([
    db.failedNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit || 50,
      skip: params.offset || 0
    }),
    db.failedNotification.count({ where })
  ])

  return {
    notifications: notifications.map(n => ({
      ...n,
      metadata: n.metadata ? JSON.parse(n.metadata) : null
    })),
    total
  }
}

/**
 * Get failed notification statistics
 */
export async function getFailedNotificationStats(): Promise<{
  total: number
  pending: number
  retrying: number
  failed: number
  sent: number
  byChannel: Record<string, number>
}> {
  const hasModel = await checkFailedNotificationModel()

  if (!hasModel) {
    return {
      total: 0,
      pending: 0,
      retrying: 0,
      failed: 0,
      sent: 0,
      byChannel: {}
    }
  }

  const [total, pending, retrying, failed, sent, byChannel] = await Promise.all([
    db.failedNotification.count(),
    db.failedNotification.count({ where: { status: 'pending' } }),
    db.failedNotification.count({ where: { status: 'retrying' } }),
    db.failedNotification.count({ where: { status: 'failed' } }),
    db.failedNotification.count({ where: { status: 'sent' } }),
    db.failedNotification.groupBy({
      by: ['channel'],
      _count: true
    })
  ])

  const channelCounts: Record<string, number> = {}
  for (const item of byChannel) {
    channelCounts[item.channel] = item._count
  }

  return {
    total,
    pending,
    retrying,
    failed,
    sent,
    byChannel: channelCounts
  }
}

/**
 * Delete old failed notifications (cleanup)
 */
export async function cleanupOldFailedNotifications(olderThanDays = 30): Promise<number> {
  const hasModel = await checkFailedNotificationModel()

  if (!hasModel) {
    return 0
  }

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

  const result = await db.failedNotification.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate
      },
      status: {
        in: ['sent', 'failed']
      }
    }
  })

  return result.count
}

/**
 * Manually retry a failed notification
 */
export async function manualRetry(notificationId: string): Promise<{
  success: boolean
  message: string
}> {
  const hasModel = await checkFailedNotificationModel()

  if (!hasModel) {
    return {
      success: false,
      message: 'FailedNotification model not initialized'
    }
  }

  const notification = await db.failedNotification.findUnique({
    where: { id: notificationId }
  })

  if (!notification) {
    return {
      success: false,
      message: 'Notification not found'
    }
  }

  if (notification.status === 'sent') {
    return {
      success: false,
      message: 'Notification already sent'
    }
  }

  // Reset for manual retry
  await db.failedNotification.update({
    where: { id: notificationId },
    data: {
      status: 'retrying',
      nextRetryAt: new Date(),
      lastAttemptAt: new Date()
    }
  })

  return {
    success: true,
    message: 'Notification queued for retry'
  }
}

async function checkFailedNotificationModel(): Promise<boolean> {
  try {
    await db.failedNotification.count()
    return true
  } catch {
    return false
  }
}

/**
 * Background job processor for retrying failed notifications
 * This should be called by a cron job or similar scheduler
 */
export async function processRetryQueue(batchSize = 10): Promise<{
  processed: number
  succeeded: number
  failed: number
  permanentlyFailed: number
}> {
  const pending = await getPendingRetries(batchSize)

  let succeeded = 0
  let failed = 0
  let permanentlyFailed = 0

  for (const notification of pending) {
    try {
      // Attempt to send the notification
      // This would call the actual notification service
      const result = await attemptNotificationRetry(notification)

      if (result.success) {
        await markNotificationSent(notification.id)
        succeeded++
      } else if (result.permanentFailure) {
        await markNotificationFailed(notification.id, result.error || 'Permanent failure')
        permanentlyFailed++
      } else {
        await markNotificationFailed(notification.id, result.error || 'Retryable failure')
        failed++
      }
    } catch (error) {
      await markNotificationFailed(notification.id, String(error))
      failed++
    }
  }

  return {
    processed: pending.length,
    succeeded,
    failed,
    permanentlyFailed
  }
}

/**
 * Attempt to send a notification retry
 * This is a placeholder - in production, you'd integrate with your actual notification service
 */
async function attemptNotificationRetry(notification: {
  id: string
  recipient: string
  channel: string
  message: string
  retryCount: number
  metadata: Record<string, unknown> | null
}): Promise<{ success: boolean; error?: string; permanentFailure?: boolean }> {
  // In production, this would call:
  // - SMS provider (Twilio, etc.)
  // - Email service (SMTP, SendGrid, etc.)
  // - WhatsApp Business API

  // For now, simulate a retry
  console.log(`[NotificationRetry] Attempting ${notification.channel} to ${notification.recipient}`)

  // Simulate success (in production, this would be actual API call result)
  const success = Math.random() > 0.3 // 70% success rate for demo

  if (success) {
    return { success: true }
  }

  return {
    success: false,
    error: 'Provider API error: Timeout',
    permanentFailure: notification.retryCount >= MAX_RETRIES
  }
}
