import { Prisma } from '@prisma/client'

// Lazy import to avoid circular dependency
function getDb() {
  return require('./db').db
}

interface AuditContext {
  userId?: string
  userName?: string
  userRole?: string
  ipAddress?: string
  impersonatingId?: string
}

let currentAuditContext: AuditContext = {}

export function setAuditContext(context: AuditContext) {
  currentAuditContext = context
}

export function getAuditContext(): AuditContext {
  return currentAuditContext
}

export function clearAuditContext() {
  currentAuditContext = {}
}

function getActionName(modelName: string, action: string): string {
  const actions: Record<string, Record<string, string>> = {
    Order: { create: 'ORDER_CREATED', update: 'ORDER_UPDATED', delete: 'ORDER_DELETED' },
    User: { create: 'USER_CREATED', update: 'USER_UPDATED', delete: 'USER_DELETED' },
    Product: { create: 'PRODUCT_CREATED', update: 'PRODUCT_UPDATED', delete: 'PRODUCT_DELETED' },
    Admin: { create: 'ADMIN_CREATED', update: 'ADMIN_UPDATED', delete: 'ADMIN_DELETED' },
    Blacklist: { create: 'BLACKLIST_ADDED', update: 'BLACKLIST_UPDATED', delete: 'BLACKLIST_REMOVED' },
    Invoice: { create: 'INVOICE_CREATED', update: 'INVOICE_UPDATED' },
    Integration: { create: 'INTEGRATION_ADDED', update: 'INTEGRATION_UPDATED', delete: 'INTEGRATION_REMOVED' }
  }
  return actions[modelName]?.[action] || `${modelName}_${action.toUpperCase()}`
}

function sanitizeData(modelName: string, data: any): any {
  const sensitiveFields = ['password', 'token', 'secret', 'authToken', 'apiKey', 'apiSecret', 'accessToken']
  const sanitized = { ...data }
  for (const field of sensitiveFields) {
    if (field in sanitized) sanitized[field] = '[REDACTED]'
  }
  if (modelName === 'Order') {
    return { trackingNumber: sanitized.trackingNumber, status: sanitized.status, recipientName: sanitized.recipientName, phone: sanitized.phone, codAmount: sanitized.codAmount }
  }
  return sanitized
}

async function createAuditLog(params: { action: string; targetType: string; targetId: string; details: any }) {
  const { action, targetType, targetId, details } = params
  try {
    const db = getDb()
    await db.auditLog.create({
      data: {
        adminId: currentAuditContext.userId || 'SYSTEM',
        userName: currentAuditContext.userName || 'System',
        userRole: currentAuditContext.userRole || 'SYSTEM',
        action,
        targetType,
        targetId,
        details: typeof details === 'string' ? details : JSON.stringify(details),
        ipAddress: currentAuditContext.ipAddress,
        impersonatingId: currentAuditContext.impersonatingId
      }
    })
  } catch (error) {
    console.error('[AuditLog] Failed:', error)
  }
}

export const auditMiddleware: Prisma.Middleware = async (params, next) => {
  const { model, action, args } = params
  const auditedModels = ['Order', 'User', 'Product', 'Admin', 'Blacklist', 'Invoice', 'Integration']
  if (!auditedModels.includes(model) || !['create', 'update', 'delete'].includes(action)) return next(params)

  const actionName = getActionName(model, action)

  if (action === 'create') {
    const result = await next(params)
    const recordId = result?.id
    if (recordId) await createAuditLog({ action: actionName, targetType: model, targetId: recordId, details: sanitizeData(model, args.data) })
    return result
  }

  if (action === 'update') {
    let beforeData: any = null
    try { beforeData = await getDb()[model as keyof ReturnType<typeof getDb>].findUnique({ where: args.where }) } catch {}
    const result = await next(params)
    if (args.where?.id) await createAuditLog({ action: actionName, targetType: model, targetId: args.where.id, details: { before: beforeData ? sanitizeData(model, beforeData) : null, after: result ? sanitizeData(model, result) : null } })
    return result
  }

  if (action === 'delete') {
    let beforeData: any = null
    try { beforeData = await getDb()[model as keyof ReturnType<typeof getDb>].findUnique({ where: args.where }) } catch {}
    const result = await next(params)
    if (args.where?.id) await createAuditLog({ action: actionName, targetType: model, targetId: args.where.id, details: { deleted: beforeData ? sanitizeData(model, beforeData) : null } })
    return result
  }

  return next(params)
}
