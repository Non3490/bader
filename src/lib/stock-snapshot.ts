import { db } from '@/lib/db'

export interface CreateDailySnapshotsResult {
  success: boolean
  count: number
  errors?: Array<{ productId: string; error: string }>
}

export async function createDailySnapshots(): Promise<CreateDailySnapshotsResult> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

  // Get all products with their stocks
  const products = await db.product.findMany({
    include: {
      stocks: true,
    },
  })

  const errors: Array<{ productId: string; error: string }> = []
  let count = 0

  for (const product of products) {
    try {
      // Get total initial stock from all warehouses
      const initialStock = product.stocks.reduce((sum, stock) => sum + stock.quantity, 0)

      // Get orders for this product from yesterday
      const orders = await db.order.findMany({
        where: {
          items: {
            some: {
              productId: product.id,
            },
          },
          createdAt: {
            gte: yesterday,
            lt: today,
          },
        },
      })

      const inForDelivery = orders.filter(
        o => o.status === 'SHIPPED' || o.status === 'CONFIRMED'
      ).length

      const outForDelivery = orders.filter(
        o => o.status === 'DELIVERED' || (o.status === 'RETURNED' && !o.isReturned)
      ).length

      const finalStock = initialStock - inForDelivery + outForDelivery

      // Check if snapshot already exists for today
      const existing = await db.stockSnapshot.findUnique({
        where: {
          productId_snapshotDate: {
            productId: product.id,
            snapshotDate: today,
          },
        },
      })

      if (existing) {
        // Update existing snapshot
        await db.stockSnapshot.update({
          where: { id: existing.id },
          data: {
            initialStock,
            inForDelivery,
            outForDelivery,
            finalStock,
          },
        })
      } else {
        // Create new snapshot
        await db.stockSnapshot.create({
          data: {
            productId: product.id,
            date: today,
            initialStock,
            inForDelivery,
            outForDelivery,
            finalStock,
            snapshotDate: today,
          },
        })
      }

      count++
    } catch (error) {
      errors.push({
        productId: product.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return {
    success: true,
    count,
    errors: errors.length > 0 ? errors : undefined,
  }
}

export async function getStockSnapshots(params: {
  productId?: string
  startDate?: Date
  endDate?: Date
}) {
  const { productId, startDate, endDate } = params

  const where: any = {}

  if (productId) {
    where.productId = productId
  }

  if (startDate || endDate) {
    where.snapshotDate = {}
    if (startDate) {
      where.snapshotDate.gte = startDate
    }
    if (endDate) {
      where.snapshotDate.lte = endDate
    }
  }

  return db.stockSnapshot.findMany({
    where,
    include: {
      product: {
        include: {
          seller: true,
        },
      },
    },
    orderBy: {
      snapshotDate: 'desc',
    },
  })
}

export async function getStockSnapshotsCSV(startDate: Date, endDate: Date) {
  const snapshots = await getStockSnapshots({ startDate, endDate })

  const headers = [
    'Product ID',
    'Product Name',
    'SKU',
    'Seller',
    'Date',
    'Initial Stock',
    'In For Delivery',
    'Out For Delivery',
    'Final Stock',
  ]

  const rows = snapshots.map(s => [
    s.productId,
    s.product.name,
    s.product.sku,
    s.product.seller.name,
    s.snapshotDate.toISOString().split('T')[0],
    s.initialStock,
    s.inForDelivery,
    s.outForDelivery,
    s.finalStock,
  ])

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
}
