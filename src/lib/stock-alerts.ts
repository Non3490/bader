import { db } from '@/lib/db'
import { broadcastLowStockAlert } from '@/lib/pusher'

export interface LowStockAlert {
  productId: string
  productName: string
  sku: string
  quantity: number
  threshold: number
  sellerId: string
}

/**
 * Check for products below their low stock threshold and trigger Pusher alerts
 */
export async function checkLowStockAlerts(sellerId?: string): Promise<LowStockAlert[]> {
  // Get all stocks, then filter by threshold
  const allStocks = await db.stock.findMany({
    where: sellerId ? { sellerId } : {},
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
    },
  })

  // Filter stocks where quantity <= alertLevel
  const lowStocks = allStocks.filter(stock => stock.quantity <= stock.alertLevel)

  const alerts: LowStockAlert[] = []

  for (const stock of lowStocks) {
    const alertData: LowStockAlert = {
      productId: stock.productId,
      productName: stock.product.name,
      sku: stock.product.sku,
      quantity: stock.quantity,
      threshold: stock.alertLevel,
      sellerId: stock.sellerId,
    }

    alerts.push(alertData)

    // Broadcast Pusher alert
    await broadcastLowStockAlert({
      ...alertData,
      timestamp: new Date().toISOString(),
    })
  }

  return alerts
}

/**
 * Get low stock alert count for a seller
 */
export async function getLowStockAlertCount(sellerId: string): Promise<number> {
  // Get all stocks for the seller, then count those below threshold
  const allStocks = await db.stock.findMany({
    where: { sellerId },
    select: { id: true, quantity: true, alertLevel: true },
  })

  return allStocks.filter(stock => stock.quantity <= stock.alertLevel).length
}
