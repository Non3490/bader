import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

// GET /api/products/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Only ADMIN and CALL_CENTER roles can access product details
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'CALL_CENTER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const product = await db.product.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        sku: true,
        name: true,
        shortDescription: true,
        longDescription: true,
        imageUrl: true,
        supplierName: true,
        supplierPhone: true,
        cargoName: true,
        cargoPhone: true,
        quantityPricing: true,
        category: true,
        sellPrice: true,
        isActive: true,
        authorizeOpen: true,
        seller: {
          select: {
            id: true,
            name: true
            // Note: costPrice is excluded for CALL_CENTER
          }
        },
        stocks: {
          select: {
            id: true,
            warehouseId: true,
            warehouse: {
              select: {
                id: true,
                name: true,
                city: true,
              },
            },
            quantity: true,
            alertLevel: true
          }
        }
        // Note: costPrice is excluded from select - sensitive data
      }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Product GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/products/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const product = await db.product.findUnique({
      where: { id: params.id },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Only ADMIN and owner SELLER can update
    if (user.role !== 'ADMIN' && product.sellerId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      shortDescription,
      longDescription,
      imageUrl,
      supplierName,
      supplierPhone,
      cargoName,
      cargoPhone,
      quantityPricing,
      category,
      costPrice,
      sellPrice,
      isActive,
      authorizeOpen,
    } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (shortDescription !== undefined) updateData.shortDescription = shortDescription
    if (longDescription !== undefined) updateData.longDescription = longDescription
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl
    if (supplierName !== undefined) updateData.supplierName = supplierName
    if (supplierPhone !== undefined) updateData.supplierPhone = supplierPhone
    if (cargoName !== undefined) updateData.cargoName = cargoName
    if (cargoPhone !== undefined) updateData.cargoPhone = cargoPhone
    if (quantityPricing !== undefined) updateData.quantityPricing = quantityPricing ? JSON.stringify(quantityPricing) : null
    if (category !== undefined) updateData.category = category
    if (costPrice !== undefined) updateData.costPrice = parseFloat(String(costPrice))
    if (sellPrice !== undefined) updateData.sellPrice = parseFloat(String(sellPrice))
    if (isActive !== undefined) updateData.isActive = isActive
    if (authorizeOpen !== undefined) updateData.authorizeOpen = authorizeOpen

    const updated = await db.product.update({
      where: { id: params.id },
      data: updateData,
    })

    await logActivity({
      userId: user.id,
      userRole: user.role,
      action: 'PRODUCT_UPDATED',
      targetId: product.id,
      description: `Updated product: ${product.name}`,
    })

    return NextResponse.json({ product: updated })
  } catch (error) {
    console.error('Product PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
