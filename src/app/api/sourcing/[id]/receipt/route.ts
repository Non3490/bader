import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'
import { broadcastActivity, ACTIVITY_EVENTS } from '@/lib/pusher'

// POST /api/sourcing/[id]/receipt — Admin records receipt of sourced items
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { receivedQty, receivedImages, damagedQty } = body

    if (!receivedQty || receivedQty < 0) {
      return NextResponse.json({ error: 'receivedQty is required and must be non-negative' }, { status: 400 })
    }

    if (damagedQty === undefined || damagedQty < 0) {
      return NextResponse.json({ error: 'damagedQty is required and must be non-negative' }, { status: 400 })
    }

    if (damagedQty > receivedQty) {
      return NextResponse.json({ error: 'damagedQty cannot exceed receivedQty' }, { status: 400 })
    }

    // Get the sourcing request
    const sourcing = await db.sourcingRequest.findUnique({
      where: { id },
      include: { seller: true }
    })

    if (!sourcing) {
      return NextResponse.json({ error: 'Sourcing request not found' }, { status: 404 })
    }

    // Calculate actual received (good items only)
    const actualReceived = receivedQty - damagedQty

    // Update product stock by finding the product that matches this sourcing request
    // First, try to find product by name, or we'd need to link productId to sourcingRequest
    // For now, we'll add stock to a generic entry or update an existing stock

    // Find or create a stock entry for this product
    const existingProduct = await db.product.findFirst({
      where: {
        sellerId: sourcing.sellerId,
        name: sourcing.productName
      }
    })

    let stockUpdated = false
    if (existingProduct) {
      // Update existing stock
      const existingStock = await db.stock.findFirst({
        where: { productId: existingProduct.id }
      })

      if (existingStock) {
        await db.stock.update({
          where: { id: existingStock.id },
          data: { quantity: { increment: actualReceived } }
        })
      } else {
        // Create new stock entry
        await db.stock.create({
          data: {
            productId: existingProduct.id,
            sellerId: sourcing.sellerId,
            warehouse: 'Default',
            quantity: actualReceived,
            alertLevel: 5
          }
        })
      }
      stockUpdated = true
    } else {
      // Product doesn't exist, we could create it or just log it
      // For now, create a new product entry
      const newProduct = await db.product.create({
        data: {
          sellerId: sourcing.sellerId,
          sku: `SRC-${Date.now()}`,
          name: sourcing.productName,
          costPrice: 0,
          sellPrice: 0,
          isActive: true
        }
      })

      await db.stock.create({
        data: {
          productId: newProduct.id,
          sellerId: sourcing.sellerId,
          warehouse: 'Default',
          quantity: actualReceived,
          alertLevel: 5
        }
      })
      stockUpdated = true
    }

    // Update sourcing request
    const updated = await db.sourcingRequest.update({
      where: { id },
      data: {
        status: 'RECEIVED',
        receivedQty,
        receivedImages: receivedImages && receivedImages.length > 0 ? JSON.stringify(receivedImages) : '[]',
        damagedQty,
        receivedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: user.id
      }
    })

    // Log activity
    await logActivity(
      user.id,
      user.role,
      'SOURCING_RECEIPT',
      `Received ${receivedQty} items (${damagedQty} damaged, ${actualReceived} added to stock) - ${sourcing.productName}`
    )

    // Broadcast activity update
    await broadcastActivity(ACTIVITY_EVENTS.NEW_ACTIVITY, {
      type: 'SOURCING_RECEIVED',
      description: `Sourcing received: ${sourcing.productName} (${actualReceived} added to stock)`,
      userId: user.id,
      userName: user.name,
      timestamp: new Date().toISOString()
    })

    // Parse images for response
    const responseData = {
      ...updated,
      images: updated.images ? JSON.parse(updated.images) : [],
      receivedImages: updated.receivedImages ? JSON.parse(updated.receivedImages) : []
    }

    return NextResponse.json({
      request: responseData,
      stockUpdated,
      actualReceived,
      message: `Successfully received ${receivedQty} items. ${actualReceived} added to stock${damagedQty > 0 ? ` (${damagedQty} damaged)` : ''}.`
    })
  } catch (error) {
    console.error('Sourcing receipt POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
