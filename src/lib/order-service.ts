import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

export interface CreateOrderInput {
  recipientName: string
  phone: string
  address: string
  city: string
  productName: string
  productSku?: string | null
  quantity: number
  codAmount: number
  note?: string | null
  source?: string // 'SHOPIFY' | 'YOUCAN' | 'DROPIFY' | 'IMPORT'
}

type CreateOrderResult = { created: { id: string; trackingNumber: string } } | { duplicate: true }

export async function createOrderFromWebhook(
  data: CreateOrderInput,
  sellerId: string
): Promise<CreateOrderResult> {
  const fifteenDaysAgo = new Date()
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)

  // Dedup: same phone + same product within 15 days
  const existing = await db.order.findFirst({
    where: {
      phone: data.phone.trim(),
      sellerId,
      items: {
        some: {
          product: { name: { equals: data.productName.trim() } }
        }
      },
      createdAt: { gte: fifteenDaysAgo }
    }
  })

  if (existing) return { duplicate: true }

  // Find or create a Product for this seller
  const sku = data.productSku?.trim() || `WH-${data.productName.trim().substring(0, 8).replace(/\s+/g, '-').toUpperCase()}`

  let product = await db.product.findUnique({
    where: { sellerId_sku: { sellerId, sku } }
  })

  if (!product) {
    product = await db.product.create({
      data: {
        sellerId,
        sku,
        name: data.productName.trim(),
        costPrice: 0,
        sellPrice: data.codAmount
      }
    })
  }

  // Generate unique tracking number
  let trackingNumber = ''
  for (let i = 0; i < 10; i++) {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
    trackingNumber = `GC-${rand}`
    const check = await db.order.findUnique({ where: { trackingNumber } })
    if (!check) break
  }

  const order = await db.$transaction(async (tx) => {
    // Find matching zone by city
    const cityTrimmed = data.city.trim()
    const matchingZone = await tx.zone.findFirst({
      where: { city: { equals: cityTrimmed, mode: 'insensitive' } },
      select: { id: true }
    })

    // Bundle Detection: Check if phone has orders from different sellers today
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)

    const existingBundleOrder = await tx.order.findFirst({
      where: {
        phone: data.phone.trim(),
        sellerId: { not: sellerId }, // Different seller
        createdAt: {
          gte: startOfToday,
          lte: endOfToday
        },
        status: { notIn: ['CANCELLED', 'RETURN_TO_STOCK'] }
      },
      orderBy: { createdAt: 'desc' },
      select: { bundleGroupId: true }
    })

    let bundleGroupId = existingBundleOrder?.bundleGroupId
    if (!bundleGroupId && existingBundleOrder) {
      // If existing order exists but has no bundleGroupId, create one and assign to both
      bundleGroupId = randomUUID()
    } else if (!bundleGroupId) {
      // No existing bundle order, check if there's any order from this phone today (same seller)
      const sameSellerOrder = await tx.order.findFirst({
        where: {
          phone: data.phone.trim(),
          sellerId,
          createdAt: {
            gte: startOfToday,
            lte: endOfToday
          }
        },
        select: { bundleGroupId: true }
      })
      bundleGroupId = sameSellerOrder?.bundleGroupId || null
    }

    const newOrder = await tx.order.create({
      data: {
        trackingNumber,
        sellerId,
        recipientName: data.recipientName.trim(),
        phone: data.phone.trim(),
        address: data.address?.trim() || 'No Address',
        city: cityTrimmed,
        zoneId: matchingZone?.id,
        codAmount: data.codAmount,
        note: data.note?.trim() ?? null,
        source: data.source ?? 'IMPORT',
        bundleGroupId,
        items: {
          create: [{
            productId: product!.id,
            quantity: data.quantity,
            unitPrice: data.codAmount
          }]
        },
        history: {
          create: {
            newStatus: 'NEW',
            changedById: sellerId,
            note: `Created via ${data.source ?? 'import'}`
          }
        }
      }
    })

    // If we found an existing bundle order without bundleGroupId, update it
    if (existingBundleOrder && bundleGroupId && !existingBundleOrder.bundleGroupId) {
      await tx.order.updateMany({
        where: {
          phone: data.phone.trim(),
          createdAt: { gte: startOfToday, lte: endOfToday },
          status: { notIn: ['CANCELLED', 'RETURN_TO_STOCK'] }
        },
        data: { bundleGroupId }
      })
    }

    return newOrder
  })

  return { created: { id: order.id, trackingNumber: order.trackingNumber } }
}

// Returns the ID of the first active ADMIN user — for webhook-created orders
export async function getWebhookUserId(): Promise<string | null> {
  const admin = await db.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true }
  })
  return admin?.id ?? null
}
