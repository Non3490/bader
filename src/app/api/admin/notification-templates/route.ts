import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, checkPermission } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { logAction, AUDIT_ACTIONS } from '@/lib/audit-logger'

// Template types
export const TEMPLATE_TYPES = {
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
  ORDER_SHIPPED: 'ORDER_SHIPPED',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  ORDER_RETURNED: 'ORDER_RETURNED',
  DELIVERY_ASSIGNED: 'DELIVERY_ASSIGNED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  WELCOME: 'WELCOME',
} as const

export type TemplateType = typeof TEMPLATE_TYPES[keyof typeof TEMPLATE_TYPES]

export const CHANNEL_TYPES = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  WHATSAPP: 'WHATSAPP',
} as const

export type ChannelType = typeof CHANNEL_TYPES[keyof typeof CHANNEL_TYPES]

// Default templates
const DEFAULT_TEMPLATES: Record<string, {
  subject?: string
  body: string
  placeholders: string[]
  description: string
}> = {
  [TEMPLATE_TYPES.ORDER_CONFIRMED]: {
    subject: 'Order Confirmed - {orderNumber}',
    body: 'Dear {customerName},\n\nYour order {orderNumber} has been confirmed!\n\nTotal Amount: {amount}\nEstimated Delivery: {deliveryEta}\n\nThank you for your order!',
    placeholders: ['customerName', 'orderNumber', 'amount', 'deliveryEta'],
    description: 'Sent when an order is confirmed'
  },
  [TEMPLATE_TYPES.ORDER_SHIPPED]: {
    subject: 'Order Shipped - {orderNumber}',
    body: 'Dear {customerName},\n\nYour order {orderNumber} has been shipped!\n\nCarrier: {carrier}\nTracking: {trackingNumber}\n\nYou can track your delivery at: {trackingUrl}',
    placeholders: ['customerName', 'orderNumber', 'carrier', 'trackingNumber', 'trackingUrl'],
    description: 'Sent when an order is shipped'
  },
  [TEMPLATE_TYPES.ORDER_DELIVERED]: {
    subject: 'Order Delivered - {orderNumber}',
    body: 'Dear {customerName},\n\nYour order {orderNumber} has been successfully delivered!\n\nThank you for shopping with us!',
    placeholders: ['customerName', 'orderNumber'],
    description: 'Sent when an order is delivered'
  },
  [TEMPLATE_TYPES.ORDER_RETURNED]: {
    subject: 'Order Returned - {orderNumber}',
    body: 'Dear {customerName},\n\nYour order {orderNumber} has been returned.\n\nReason: {returnReason}\n\nWe will process your refund within 5-7 business days.',
    placeholders: ['customerName', 'orderNumber', 'returnReason'],
    description: 'Sent when an order is returned'
  },
  [TEMPLATE_TYPES.DELIVERY_ASSIGNED]: {
    subject: 'Delivery Assigned - {orderNumber}',
    body: 'Hello {driverName},\n\nYou have been assigned a new delivery:\n\nOrder: {orderNumber}\nCustomer: {customerName}\nAddress: {address}\nPhone: {phone}\nCOD Amount: {codAmount}\n\nPlease deliver as soon as possible.',
    placeholders: ['driverName', 'orderNumber', 'customerName', 'address', 'phone', 'codAmount'],
    description: 'Sent to driver when delivery is assigned'
  },
  [TEMPLATE_TYPES.PAYMENT_RECEIVED]: {
    subject: 'Payment Received - Invoice {invoiceNumber}',
    body: 'Hello {sellerName},\n\nWe have received your payment of {amount}.\n\nInvoice: {invoiceNumber}\nDate: {date}\n\nThank you!',
    placeholders: ['sellerName', 'amount', 'invoiceNumber', 'date'],
    description: 'Sent when seller payment is received'
  },
  [TEMPLATE_TYPES.PASSWORD_RESET]: {
    subject: 'Password Reset',
    body: 'Hello {name},\n\nYour password has been reset.\n\nNew Password: {newPassword}\n\nPlease log in and change your password immediately.',
    placeholders: ['name', 'newPassword'],
    description: 'Sent when password is reset'
  },
  [TEMPLATE_TYPES.WELCOME]: {
    subject: 'Welcome to Gabon COD!',
    body: 'Hello {name},\n\nWelcome to Gabon COD Platform!\n\nYour account has been created successfully.\n\nLogin Email: {email}\n\nIf you have any questions, feel free to contact us.',
    placeholders: ['name', 'email'],
    description: 'Sent when new user registers'
  },
}

// Notification Template model - add to schema
// model NotificationTemplate {
//   id          String   @id @default(cuid())
//   type        String   // ORDER_CONFIRMED, ORDER_SHIPPED, etc.
//   channel     String   // EMAIL, SMS, WHATSAPP
//   subject     String?  // For email
//   body        String   // Template body with placeholders
//   isActive    Boolean  @default(true)
//   language    String   @default("en")
//   createdAt   DateTime @default(now())
//   updatedAt   DateTime @updatedAt
// }

interface NotificationTemplate {
  id: string
  type: TemplateType
  channel: ChannelType
  subject: string | null
  body: string
  isActive: boolean
  language: string
  placeholders: string[]
  description: string
}

// GET /api/admin/notification-templates - Get all notification templates
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = checkPermission(session.role as any, 'notifications:configure')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if NotificationTemplate model exists
    const hasTemplatesModel = await checkTemplatesModel()

    if (!hasTemplatesModel) {
      // Return default templates if model doesn't exist yet
      const defaultTemplates: NotificationTemplate[] = []

      for (const [type, template] of Object.entries(DEFAULT_TEMPLATES)) {
        // Add email template
        defaultTemplates.push({
          id: `default_${type}_email`,
          type: type as TemplateType,
          channel: CHANNEL_TYPES.EMAIL,
          subject: template.subject || null,
          body: template.body,
          isActive: true,
          language: 'en',
          placeholders: template.placeholders,
          description: template.description
        })

        // Add SMS template (without subject)
        defaultTemplates.push({
          id: `default_${type}_sms`,
          type: type as TemplateType,
          channel: CHANNEL_TYPES.SMS,
          subject: null,
          body: template.body,
          isActive: true,
          language: 'en',
          placeholders: template.placeholders,
          description: template.description
        })
      }

      return NextResponse.json({ templates: defaultTemplates })
    }

    // Fetch templates from database
    const templates = await db.notificationTemplate.findMany({
      orderBy: [{ type: 'asc' }, { channel: 'asc' }]
    })

    const enrichedTemplates: NotificationTemplate[] = templates.map(t => ({
      ...t,
      placeholders: DEFAULT_TEMPLATES[t.type as TemplateType]?.placeholders || [],
      description: DEFAULT_TEMPLATES[t.type as TemplateType]?.description || ''
    }))

    return NextResponse.json({ templates: enrichedTemplates })
  } catch (error) {
    console.error('Get notification templates error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/notification-templates - Update notification template
export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = checkPermission(session.role as any, 'notifications:configure')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { templateId, subject, body: templateBody, isActive } = body

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 }
      )
    }

    if (!templateBody || templateBody.trim().length === 0) {
      return NextResponse.json(
        { error: 'Template body cannot be empty' },
        { status: 400 }
      )
    }

    const hasTemplatesModel = await checkTemplatesModel()

    if (!hasTemplatesModel) {
      return NextResponse.json(
        { error: 'Notification templates model not yet initialized. Please run migrations.' },
        { status: 503 }
      )
    }

    const existing = await db.notificationTemplate.findUnique({
      where: { id: templateId }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    const updated = await db.notificationTemplate.update({
      where: { id: templateId },
      data: {
        subject: subject || null,
        body: templateBody,
        isActive: isActive !== undefined ? isActive : existing.isActive
      }
    })

    await logAction(
      session.adminId,
      session.name,
      session.role as any,
      {
        action: AUDIT_ACTIONS.NOTIFICATION_CONFIG_CHANGED,
        targetType: 'NotificationTemplate',
        targetId: templateId,
        details: {
          before: { subject: existing.subject, body: existing.body, isActive: existing.isActive },
          after: { subject: updated.subject, body: updated.body, isActive: updated.isActive }
        }
      }
    )

    return NextResponse.json({
      success: true,
      template: {
        ...updated,
        placeholders: DEFAULT_TEMPLATES[updated.type as TemplateType]?.placeholders || [],
        description: DEFAULT_TEMPLATES[updated.type as TemplateType]?.description || ''
      }
    })
  } catch (error) {
    console.error('Update notification template error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/notification-templates/reset - Reset template to default
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = checkPermission(session.role as any, 'notifications:configure')
    if (!permissionCheck.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { templateType, channel } = body

    if (!templateType || !channel) {
      return NextResponse.json(
        { error: 'templateType and channel are required' },
        { status: 400 }
      )
    }

    const defaultTemplate = DEFAULT_TEMPLATES[templateType as TemplateType]
    if (!defaultTemplate) {
      return NextResponse.json(
        { error: 'Invalid template type' },
        { status: 400 }
      )
    }

    const hasTemplatesModel = await checkTemplatesModel()

    if (!hasTemplatesModel) {
      return NextResponse.json(
        { error: 'Notification templates model not yet initialized. Please run migrations.' },
        { status: 503 }
      )
    }

    const existing = await db.notificationTemplate.findFirst({
      where: {
        type: templateType,
        channel: channel
      }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    const updated = await db.notificationTemplate.update({
      where: { id: existing.id },
      data: {
        subject: defaultTemplate.subject || null,
        body: defaultTemplate.body,
        isActive: true
      }
    })

    await logAction(
      session.adminId,
      session.name,
      session.role as any,
      {
        action: AUDIT_ACTIONS.NOTIFICATION_CONFIG_CHANGED,
        targetType: 'NotificationTemplate',
        targetId: existing.id,
        details: {
          action: 'reset_to_default',
          templateType
        }
      }
    )

    return NextResponse.json({
      success: true,
      template: {
        ...updated,
        placeholders: defaultTemplate.placeholders,
        description: defaultTemplate.description
      }
    })
  } catch (error) {
    console.error('Reset notification template error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function checkTemplatesModel(): Promise<boolean> {
  try {
    await db.notificationTemplate.count()
    return true
  } catch {
    return false
  }
}
