import { db } from '@/lib/db'

export interface StockDeductionResult {
  success: boolean
  error?: string
  deductedItems?: Array<{
    productId: string
    productName: string
    quantity: number
    stockId: string
  }>
}

/**
 * Automatically deduct stock when order is confirmed
 */
export async function deductStockOnOrderConfirm(orderId: string, userId?: string): Promise<StockDeductionResult> {
  try {
    // Get order with items
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!order) {
      return { success: false, error: 'Order not found' }
    }

    const deductedItems: StockDeductionResult['deductedItems'] = []

    for (const item of order.items) {
      // Find stock for this product (prefer same warehouse or any available)
      const stock = await db.stock.findFirst({
        where: {
          productId: item.productId,
          sellerId: order.sellerId,
        },
        orderBy: { quantity: 'desc' }, // Get stock with most quantity first
      })

      if (!stock) {
        // Create stock record if doesn't exist
        const newStock = await db.stock.create({
          data: {
            productId: item.productId,
            sellerId: order.sellerId,
            quantity: 0,
            alertLevel: 5,
          },
        })

        // Record movement
        await db.stockMovement.create({
          data: {
            stockId: newStock.id,
            type: 'AUTO_DEDUCT',
            quantity: item.quantity,
            reason: `Order ${order.trackingNumber} confirmed - no stock exists`,
            userId,
          },
        })

        deductedItems.push({
          productId: item.productId,
          productName: item.product.name,
          quantity: item.quantity,
          stockId: newStock.id,
        })
        continue
      }

      // Check if sufficient stock
      if (stock.quantity < item.quantity) {
        // Still deduct but with warning (as per spec)
        await db.stock.update({
          where: { id: stock.id },
          data: { quantity: 0 },
        })

        await db.stockMovement.create({
          data: {
            stockId: stock.id,
            type: 'AUTO_DEDUCT',
            quantity: stock.quantity, // Record what was actually available
            reason: `Order ${order.trackingNumber} confirmed - insufficient stock warning`,
            userId,
          },
        })

        deductedItems.push({
          productId: item.productId,
          productName: item.product.name,
          quantity: stock.quantity,
          stockId: stock.id,
        })
        continue
      }

      // Deduct stock
      await db.stock.update({
        where: { id: stock.id },
        data: { quantity: { decrement: item.quantity } },
      })

      // Create movement record
      await db.stockMovement.create({
        data: {
          stockId: stock.id,
          type: 'AUTO_DEDUCT',
          quantity: item.quantity,
          reason: `Order ${order.trackingNumber} confirmed`,
          userId,
        },
      })

      deductedItems.push({
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        stockId: stock.id,
      })
    }

    return { success: true, deductedItems }
  } catch (error) {
    console.error('Stock deduction error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Automatically return stock when order is returned
 */
export async function returnStockOnOrderReturn(orderId: string, userId?: string): Promise<StockDeductionResult> {
  try {
    // Get order with items
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!order) {
      return { success: false, error: 'Order not found' }
    }

    const returnedItems: StockDeductionResult['deductedItems'] = []

    for (const item of order.items) {
      // Find stock for this product
      const stock = await db.stock.findFirst({
        where: {
          productId: item.productId,
          sellerId: order.sellerId,
        },
        orderBy: { quantity: 'asc' }, // Prefer stock with less quantity
      })

      if (!stock) {
        // Create stock record if doesn't exist
        const newStock = await db.stock.create({
          data: {
            productId: item.productId,
            sellerId: order.sellerId,
            quantity: item.quantity,
            alertLevel: 5,
          },
        })

        // Record movement
        await db.stockMovement.create({
          data: {
            stockId: newStock.id,
            type: 'AUTO_RETURN',
            quantity: item.quantity,
            reason: `Order ${order.trackingNumber} returned`,
            userId,
          },
        })

        returnedItems.push({
          productId: item.productId,
          productName: item.product.name,
          quantity: item.quantity,
          stockId: newStock.id,
        })
        continue
      }

      // Return stock
      await db.stock.update({
        where: { id: stock.id },
        data: { quantity: { increment: item.quantity } },
      })

      // Create movement record
      await db.stockMovement.create({
        data: {
          stockId: stock.id,
          type: 'AUTO_RETURN',
          quantity: item.quantity,
          reason: `Order ${order.trackingNumber} returned`,
          userId,
        },
      })

      returnedItems.push({
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        stockId: stock.id,
      })
    }

    return { success: true, deductedItems: returnedItems }
  } catch (error) {
    console.error('Stock return error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
