import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity } from '@/lib/activity-logger'

// GET /api/sourcing/[id] — Get single request
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    const request = await db.sourcingRequest.findUnique({
      where: { id },
      include: {
        seller: {
          select: { id: true, name: true, email: true, phone: true }
        }
      }
    })

    if (!request) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Sellers can only see their own requests
    if (user.role === 'SELLER' && request.sellerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ request })
  } catch (error) {
    console.error('Get Sourcing Request Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH /api/sourcing/[id] — Admin updates status, adds notes, received qty
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can update sourcing requests
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { id } = params
    const body = await req.json()
    const { status, adminNote, receivedQty, receivedImages, damagedQty, trackingCode } = body

    // Get current request
    const existing = await db.sourcingRequest.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true } }
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updateData: any = {}
    if (status !== undefined) updateData.status = status
    if (adminNote !== undefined) updateData.adminNote = adminNote
    if (receivedQty !== undefined) updateData.receivedQty = parseInt(receivedQty, 10)
    if (receivedImages !== undefined) updateData.receivedImages = receivedImages
    if (damagedQty !== undefined) updateData.damagedQty = parseInt(damagedQty, 10)
    if (trackingCode !== undefined) {
      updateData.trackingDetails = existing.trackingDetails
        ? JSON.stringify({ ...JSON.parse(existing.trackingDetails || '{}'), trackingCode })
        : JSON.stringify({ trackingCode })
    }

    const updated = await db.sourcingRequest.update({
      where: { id },
      data: updateData,
      include: {
        seller: { select: { id: true, name: true } }
      }
    })

    // Log activity
    await logActivity({
      userId: user.id,
      userRole: user.role,
      action: 'SOURCING_STATUS_UPDATE',
      resourceType: 'SourcingRequest',
      resourceId: id,
      details: {
        oldStatus: existing.status,
        newStatus: status,
        adminNote
      }
    }).catch(console.error)

    // Auto-stock: when status changes to STOCKED, create/update product inventory
    if (status === 'STOCKED' && existing.status !== 'STOCKED') {
      await autoStockSourcingRequest(updated)
    }

    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error('Update Sourcing Request Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Helper: auto-create stock entry when sourcing request is marked STOCKED
async function autoStockSourcingRequest(request: any) {
  try {
    const receivedQty = request.receivedQty || request.quantity
    const goodQty = Math.max(0, receivedQty - (request.damagedQty || 0))

    if (goodQty <= 0) return

    // Parse images from the sourcing request
    const images = request.images ? JSON.parse(request.images) : []

    // Check if a product with this sourcing link already exists
    const existingProduct = await db.product.findFirst({
      where: {
        sellerId: request.sellerId,
        sourcingRequestId: request.id
      }
    }).catch(() => null)

    if (existingProduct) {
      // Update existing product stock
      await db.product.update({
        where: { id: existingProduct.id },
        data: {
          currentStock: { increment: goodQty },
          imageUrl: images.length > 0 ? images[0] : existingProduct.imageUrl
        }
      }).catch(console.error)
    } else {
      // Generate SKU for sourced product
      const sku = `SRC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`

      // Create new product from sourcing request
      await db.product.create({
        data: {
          sellerId: request.sellerId,
          sku,
          name: request.productName,
          shortDescription: request.description || `Produit sourcé - ${request.productName}`,
          longDescription: request.description || `Produit sourcé - ${request.productName}`,
          imageUrl: images.length > 0 ? images[0] : null,
          costPrice: 0,
          sellPrice: 0,
          currentStock: goodQty,
          sourcingRequestId: request.id,
          isActive: true,
        }
      }).catch(console.error)
    }
  } catch (err) {
    console.error('Auto-stock failed for sourcing request:', err)
  }
}
