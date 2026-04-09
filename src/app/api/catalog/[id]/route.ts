import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

// PATCH /api/catalog/[id] — admin updates catalog product
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, description, imageUrl, costPrice, category, countryAvailable, isActive } = body

    const product = await db.catalogProduct.update({
      where: { id },
      data: {
        ...(name != null && { name }),
        ...(description != null && { description }),
        ...(imageUrl != null && { imageUrl }),
        ...(costPrice != null && { costPrice: parseFloat(costPrice) }),
        ...(category != null && { category }),
        ...(countryAvailable != null && { countryAvailable }),
        ...(isActive != null && { isActive })
      }
    })

    logActivity(user.id, user.role, 'CATALOG_PRODUCT_UPDATED', product.name).catch(() => {})
    return NextResponse.json({ product })
  } catch (error) {
    console.error('Catalog PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/catalog/[id] — admin deletes catalog product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { id } = await params
    await db.catalogProduct.delete({ where: { id } })
    logActivity(user.id, user.role, 'CATALOG_PRODUCT_DELETED', id).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Catalog DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
