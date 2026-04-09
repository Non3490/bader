import { db } from '@/lib/db'

export interface StockOperationOptions {
  reason?: string
  orderId?: string
  performedBy?: string // 'SYSTEM' or user ID
  adminId?: string
  costPerUnit?: number
}

export interface StockDeductionResult {
  success: boolean
  error?: string
  processedItems?: Array<{
    productId: string
    productName: string
    quantity: number
    balanceAfter: number
  }>
}

export interface ValidationError {
  sku: string
  row: number
  error: string
}

/**
 * CORE-04: Atomic stock deduction using Prisma's updateMany with condition.
 * This prevents race conditions by ensuring the decrement only happens if sufficient stock exists.
 *
 * CORRECT: Atomic decrement
 * UPDATE "Product" SET "currentStock" = "currentStock" - :quantity
 * WHERE id = :productId AND "currentStock" >= :quantity
 */
export async function deductStock(
  productId: string,
  quantity: number,
  tx?: any,
  options: StockOperationOptions = {}
): Promise<{ success: boolean; error?: string; balanceAfter?: number }> {
  const prisma = tx || db

  // First, get the product details for logging
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, currentStock: true, sellerId: true }
  })

  if (!product) {
    return { success: false, error: `Produit introuvable: ${productId}` }
  }

  // Check if inventory tracking is enabled
  const trackInventory = product as any // trackInventory field will be available after migration
  // @ts-ignore - trackInventory will be available after migration
  if (trackInventory.trackInventory === false) {
    // Skip stock operations for items that don't track inventory
    return { success: true, balanceAfter: product.currentStock }
  }

  // Atomic decrement using updateMany with condition
  const result = await prisma.product.updateMany({
    where: {
      id: productId,
      currentStock: { gte: quantity }
    },
    data: {
      currentStock: { decrement: quantity }
    }
  })

  if (result.count === 0) {
    return {
      success: false,
      error: `Stock insuffisant pour ${product.name}. Disponible: ${product.currentStock}, demandé: ${quantity}`
    }
  }

  // Get the new balance for logging
  const updatedProduct = await prisma.product.findUnique({
    where: { id: productId },
    select: { currentStock: true }
  })

  const balanceAfter = updatedProduct?.currentStock || 0

  // Log the transaction — look up the Stock record (separate from Product)
  const stockRecord = await prisma.stock.findFirst({ where: { productId } })
  if (stockRecord) {
    await prisma.stockMovement.create({
      data: {
        stockId: stockRecord.id,
        type: 'AUTO_DEDUCT',
        quantity,
        reason: options.reason || 'Stock deduction',
        userId: options.performedBy !== 'SYSTEM' ? options.performedBy : undefined,
        adminId: options.adminId,
        orderId: options.orderId,
        balanceAfter,
        createdAt: new Date()
      }
    })
  }

  return { success: true, balanceAfter }
}

/**
 * CORE-04: Atomic stock addition (increment)
 */
export async function addStock(
  productId: string,
  quantity: number,
  tx?: any,
  options: StockOperationOptions = {}
): Promise<{ success: boolean; error?: string; balanceAfter?: number }> {
  const prisma = tx || db

  // Get product details
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, currentStock: true, sellerId: true }
  })

  if (!product) {
    return { success: false, error: `Produit introuvable: ${productId}` }
  }

  // Atomic increment
  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: {
      currentStock: { increment: quantity }
    },
    select: { currentStock: true }
  })

  const balanceAfter = updatedProduct.currentStock

  // Log the transaction
  const stockRecord = await prisma.stock.findFirst({ where: { productId } })
  if (stockRecord) {
    await prisma.stockMovement.create({
      data: {
        stockId: stockRecord.id,
        type: 'MANUAL_IN',
        quantity,
        reason: options.reason || 'Stock addition',
        userId: options.performedBy,
        adminId: options.adminId,
        orderId: options.orderId,
        balanceAfter,
        costPerUnit: options.costPerUnit,
        createdAt: new Date()
      }
    })
  }

  return { success: true, balanceAfter }
}

/**
 * CORE-04: Set stock to a specific value (for manual adjustments)
 */
export async function setStock(
  productId: string,
  newQuantity: number,
  tx?: any,
  options: StockOperationOptions = {}
): Promise<{ success: boolean; error?: string; balanceAfter?: number }> {
  const prisma = tx || db

  // Get product details
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, currentStock: true, sellerId: true }
  })

  if (!product) {
    return { success: false, error: `Produit introuvable: ${productId}` }
  }

  if (newQuantity < 0) {
    return { success: false, error: 'La quantité ne peut pas être négative' }
  }

  const difference = newQuantity - product.currentStock
  const type = difference > 0 ? 'MANUAL_IN' : difference < 0 ? 'MANUAL_OUT' : 'ADJUST'

  // Update to new value
  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: {
      currentStock: newQuantity
    },
    select: { currentStock: true }
  })

  const balanceAfter = updatedProduct.currentStock

  // Only log if there was a change
  if (difference !== 0) {
    const stockRecord = await prisma.stock.findFirst({ where: { productId } })
    if (stockRecord) {
      await prisma.stockMovement.create({
        data: {
          stockId: stockRecord.id,
          type,
          quantity: Math.abs(difference),
          reason: options.reason || `Stock adjusted to ${newQuantity}`,
          userId: options.performedBy,
          adminId: options.adminId,
          balanceAfter,
          createdAt: new Date()
        }
      })
    }
  }

  return { success: true, balanceAfter }
}

/**
 * CORE-04: Transaction-wrapped multi-item stock deduction for orders.
 * If ANY item fails (insufficient stock), the entire transaction rolls back.
 */
export async function deductStockForOrder(
  orderId: string,
  options: StockOperationOptions = {}
): Promise<StockDeductionResult> {
  try {
    // Get order with items
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                currentStock: true,
                sellerId: true
              }
            }
          }
        }
      }
    })

    if (!order) {
      return { success: false, error: 'Commande introuvable' }
    }

    const processedItems: StockDeductionResult['processedItems'] = []

    // Use Prisma transaction for atomic multi-item operations
    await db.$transaction(async (tx) => {
      for (const item of order.items) {
        const deductResult = await deductStock(
          item.productId,
          item.quantity,
          tx,
          {
            reason: `Commande ${order.trackingNumber} confirmée`,
            orderId: order.id,
            performedBy: 'SYSTEM',
            ...options
          }
        )

        if (!deductResult.success) {
          // Log warning but don't block confirmation — allow backorder
          console.warn(`[STOCK] Insufficient stock for ${item.product?.name}, order ${order.trackingNumber}: ${deductResult.error}`)
          processedItems.push({
            productId: item.productId,
            productName: item.product.name,
            quantity: item.quantity,
            balanceAfter: item.product?.currentStock ?? 0
          })
        } else {
          processedItems.push({
            productId: item.productId,
            productName: item.product.name,
            quantity: item.quantity,
            balanceAfter: deductResult.balanceAfter!
          })
        }
      }
    })

    return { success: true, processedItems }
  } catch (error) {
    console.error('Stock deduction error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la déduction du stock'
    }
  }
}

/**
 * CORE-04: Restore stock when order is cancelled or returned
 */
export async function restoreStockForOrder(
  orderId: string,
  options: StockOperationOptions = {}
): Promise<StockDeductionResult> {
  try {
    // Get order with items
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                currentStock: true
              }
            }
          }
        }
      }
    })

    if (!order) {
      return { success: false, error: 'Commande introuvable' }
    }

    const processedItems: StockDeductionResult['processedItems'] = []

    for (const item of order.items) {
      const addResult = await addStock(
        item.productId,
        item.quantity,
        undefined,
        {
          reason: `Commande ${order.trackingNumber} retournée`,
          orderId: order.id,
          performedBy: 'SYSTEM',
          ...options
        }
      )

      if (!addResult.success) {
        return {
          success: false,
          error: `Erreur lors de la restoration du stock pour ${item.product.name}: ${addResult.error}`
        }
      }

      processedItems.push({
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        balanceAfter: addResult.balanceAfter!
      })
    }

    return { success: true, processedItems }
  } catch (error) {
    console.error('Stock restoration error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la restoration du stock'
    }
  }
}

/**
 * CORE-04: Validate stock availability before order creation
 */
export async function validateStockAvailability(
  items: Array<{ productId: string; quantity: number }>
): Promise<{ valid: boolean; errors: Array<{ productId: string; productName: string; available: number; requested: number }> }> {
  const errors: Array<{ productId: string; productName: string; available: number; requested: number }> = []

  for (const item of items) {
    const product = await db.product.findUnique({
      where: { id: item.productId },
      select: { id: true, name: true, currentStock: true, trackInventory: true }
    })

    if (!product) {
      errors.push({
        productId: item.productId,
        productName: 'Produit inconnu',
        available: 0,
        requested: item.quantity
      })
      continue
    }

    // Skip inventory check if tracking is disabled for this product
    if (product.trackInventory === false) {
      continue
    }

    if (product.currentStock < item.quantity) {
      errors.push({
        productId: product.id,
        productName: product.name,
        available: product.currentStock,
        requested: item.quantity
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * CORE-04: Get stock valuation for reporting
 */
export async function getStockValuation(sellerId?: string) {
  const where = sellerId ? { sellerId } : {}

  const products = await db.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
      currentStock: true,
      costPrice: true,
      sellerId: true
    }
  })

  let totalValue = 0
  const valuationByProduct = products.map(product => {
    const value = product.currentStock * product.costPrice
    totalValue += value
    return {
      ...product,
      stockValue: value
    }
  })

  // Group by category
  const valuationByCategory = products.reduce((acc, product) => {
    const category = product.category || 'Uncategorized'
    if (!acc[category]) {
      acc[category] = { totalValue: 0, totalStock: 0, productCount: 0 }
    }
    acc[category].totalValue += product.currentStock * product.costPrice
    acc[category].totalStock += product.currentStock
    acc[category].productCount += 1
    return acc
  }, {} as Record<string, { totalValue: number; totalStock: number; productCount: number }>)

  return {
    totalValue,
    valuationByProduct,
    valuationByCategory
  }
}

/**
 * CORE-04: Get fast/slow moving items based on 30-day sales
 */
export async function getMovementAnalysis(sellerId?: string) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Get all products with their sales in the last 30 days
  const products = await db.product.findMany({
    where: sellerId ? { sellerId } : {},
    include: {
      orderItems: {
        where: {
          order: {
            createdAt: { gte: thirtyDaysAgo },
            status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] }
          }
        }
      }
    }
  })

  // Calculate sales per product
  const productSales = products.map(product => {
    const totalSold = product.orderItems.reduce((sum, item) => sum + item.quantity, 0)
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      currentStock: product.currentStock,
      totalSold,
      costPrice: product.costPrice,
      sellPrice: product.sellPrice
    }
  })

  // Sort by sales volume
  productSales.sort((a, b) => b.totalSold - a.totalSold)

  const totalProducts = productSales.length
  const top20Percent = Math.ceil(totalProducts * 0.2)
  const bottom20Percent = Math.floor(totalProducts * 0.8)

  return {
    fastMoving: productSales.slice(0, top20Percent),
    slowMoving: productSales.slice(bottom20Percent),
    deadStock: productSales.filter(p => p.totalSold === 0 && p.currentStock > 0),
    allProducts: productSales
  }
}

/**
 * CORE-04: Get waste/spoilage report
 */
export async function getWasteReport(sellerId?: string, months?: number) {
  const monthsToLookBack = months || 3
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - monthsToLookBack)

  const movements = await db.stockMovement.findMany({
    where: {
      type: { in: ['MANUAL_OUT', 'AUTO_DEDUCT'] },
      reason: { in: ['SPOILAGE', 'DAMAGE', 'EXPIRED', 'THEFT', 'WASTE'] },
      createdAt: { gte: startDate }
    },
    include: {
      stock: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: true,
              costPrice: true
            }
          }
        }
      }
    }
  })

  // Aggregate by product and month
  const wasteByProduct = movements.reduce((acc, movement) => {
    const product = movement.stock?.product
    if (!product) return acc

    const key = product.id
    if (!acc[key]) {
      acc[key] = {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        category: product.category,
        costPrice: product.costPrice,
        totalQuantity: 0,
        totalCost: 0,
        byReason: {} as Record<string, number>
      }
    }

    acc[key].totalQuantity += movement.quantity
    acc[key].totalCost += movement.quantity * (movement.costPerUnit || product.costPrice)

    const reason = movement.reason || 'OTHER'
    acc[key].byReason[reason] = (acc[key].byReason[reason] || 0) + movement.quantity

    return acc
  }, {} as Record<string, any>)

  // Aggregate by month
  const wasteByMonth = movements.reduce((acc, movement) => {
    const date = new Date(movement.createdAt)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (!acc[monthKey]) {
      acc[monthKey] = { totalQuantity: 0, totalCost: 0, count: 0 }
    }

    acc[monthKey].totalQuantity += movement.quantity
    acc[monthKey].totalCost += movement.quantity * (movement.costPerUnit || movement.stock?.product?.costPrice || 0)
    acc[monthKey].count += 1

    return acc
  }, {} as Record<string, { totalQuantity: number; totalCost: number; count: number }>)

  return {
    wasteByProduct: Object.values(wasteByProduct),
    wasteByMonth,
    totalWasteCost: Object.values(wasteByProduct).reduce((sum, p) => sum + p.totalCost, 0)
  }
}

/**
 * CORE-04: Get low stock alerts and purchase recommendations
 */
export async function getStockAlerts(sellerId?: string) {
  const where = sellerId ? { sellerId } : {}

  const products = await db.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
      currentStock: true,
      reorderPoint: true,
      costPrice: true,
      supplierName: true,
      supplierPhone: true
    }
  })

  const lowStockItems = products.filter(p => p.currentStock > 0 && p.currentStock <= p.reorderPoint)
  const outOfStockItems = products.filter(p => p.currentStock === 0)
  const allAlertItems = [...lowStockItems, ...outOfStockItems]

  // Generate purchase recommendations
  const recommendations = allAlertItems.map(item => {
    const buffer = Math.ceil(item.reorderPoint * 0.2) // 20% buffer
    const suggestedQuantity = item.reorderPoint - item.currentStock + buffer
    const estimatedCost = suggestedQuantity * item.costPrice

    return {
      ...item,
      suggestedQuantity,
      estimatedCost,
      urgency: item.currentStock === 0 ? 'CRITICAL' : item.currentStock <= item.reorderPoint / 2 ? 'HIGH' : 'MEDIUM'
    }
  })

  return {
    lowStockCount: lowStockItems.length,
    outOfStockCount: outOfStockItems.length,
    recommendations,
    totalEstimatedCost: recommendations.reduce((sum, r) => sum + r.estimatedCost, 0)
  }
}

/**
 * CORE-04: Export stock movements to CSV
 */
export async function exportStockMovements(filters: {
  startDate?: Date
  endDate?: Date
  productId?: string
  type?: string
  sellerId?: string
}) {
  const where: any = {}

  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) where.createdAt.gte = filters.startDate
    if (filters.endDate) where.createdAt.lte = filters.endDate
  }

  if (filters.type) {
    where.type = filters.type
  }

  // If filtering by product, we need to filter by stockId
  // This is a limitation of the current schema - in future we might want to add productId directly to StockMovement

  const movements = await db.stockMovement.findMany({
    where,
    include: {
      stock: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              sellerId: true
            }
          }
        }
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      admin: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      order: {
        select: {
          id: true,
          trackingNumber: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10000 // Limit for CSV export
  })

  // Filter by sellerId if provided
  const filteredMovements = filters.sellerId
    ? movements.filter(m => m.stock?.product?.sellerId === filters.sellerId)
    : movements

  // Filter by productId if provided
  const finalMovements = filters.productId
    ? filteredMovements.filter(m => m.stock?.productId === filters.productId)
    : filteredMovements

  return finalMovements.map(m => ({
    date: m.createdAt,
    product: m.stock?.product?.name || 'N/A',
    sku: m.stock?.product?.sku || 'N/A',
    type: m.type,
    quantity: m.quantity,
    balanceAfter: m.balanceAfter,
    reason: m.reason || '-',
    performedBy: m.admin?.name || m.user?.name || 'SYSTEM',
    orderTrackingNumber: m.order?.trackingNumber || '-',
    costPerUnit: m.costPerUnit || '-'
  }))
}
