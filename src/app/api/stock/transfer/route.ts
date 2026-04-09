import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { broadcastActivity } from '@/lib/pusher'
import { logActivity } from '@/lib/activity-logger'

// POST /api/stock/transfer
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (user.role !== 'ADMIN' && user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { productId, sourceWarehouseId, destinationWarehouseId, quantity, reason } = body

    if (!productId || !sourceWarehouseId || !destinationWarehouseId || !quantity) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, sourceWarehouseId, destinationWarehouseId, quantity' },
        { status: 400 }
      )
    }

    if (sourceWarehouseId === destinationWarehouseId) {
      return NextResponse.json({ error: 'Source and destination warehouses cannot be the same' }, { status: 400 })
    }

    if (parseInt(quantity) <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than 0' }, { status: 400 })
    }

    const product = await db.product.findUnique({
      where: { id: productId },
      include: { stocks: true },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Check ownership
    if (user.role === 'SELLER' && product.sellerId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized - not your product' }, { status: 403 })
    }

    // Find source stock
    const sourceStock = product.stocks.find(s => s.warehouseId === sourceWarehouseId)
    if (!sourceStock) {
      return NextResponse.json({ error: 'Source warehouse stock not found' }, { status: 404 })
    }

    if (sourceStock.quantity < parseInt(quantity)) {
      return NextResponse.json({ error: 'Insufficient stock at source warehouse' }, { status: 400 })
    }

    const transferQty = parseInt(quantity)

    const result = await db.$transaction(async (tx) => {
      // Deduct from source
      await tx.stock.update({
        where: { id: sourceStock.id },
        data: { quantity: { decrement: transferQty } },
      })

      // Create OUT movement for source
      const outMovement = await tx.stockMovement.create({
        data: {
          stockId: sourceStock.id,
          warehouseId: sourceWarehouseId,
          type: 'TRANSFER_OUT',
          quantity: transferQty,
          reason: reason || 'Transfer',
        },
      })

      // Find or create destination stock
      let destStock = product.stocks.find(s => s.warehouseId === destinationWarehouseId)

      if (!destStock) {
        // Create destination stock
        destStock = await tx.stock.create({
          data: {
            productId,
            sellerId: product.sellerId,
            warehouseId: destinationWarehouseId,
            quantity: transferQty,
            alertLevel: 5,
          },
        })
      } else {
        // Update destination stock
        await tx.stock.update({
          where: { id: destStock.id },
          data: { quantity: { increment: transferQty } },
        })
      }

      // Create IN movement for destination
      await tx.stockMovement.create({
        data: {
          stockId: destStock.id,
          warehouseId: destinationWarehouseId,
          type: 'TRANSFER_IN',
          quantity: transferQty,
          reason: reason || 'Transfer',
        },
      })

      // Log activity
      await logActivity({
        userId: user.id,
        userRole: user.role,
        action: 'STOCK_TRANSFER',
        targetId: product.id,
        description: `Transferred ${transferQty} units of ${product.name} (${product.sku}) from warehouse ${sourceWarehouseId} to ${destinationWarehouseId}`,
      })

      return { outMovement }
    })

    return NextResponse.json({
      success: true,
      transferred: transferQty,
      movementId: result.outMovement.id,
    }, { status: 201 })
  } catch (error) {
    console.error('Stock transfer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
