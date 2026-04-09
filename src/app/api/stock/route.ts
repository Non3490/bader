import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity } from '@/lib/activity-logger'
import { broadcastLowStockAlert } from '@/lib/pusher'

export async function GET(req: Request) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const alertOnly = searchParams.get('alerts') === 'true'

    const query: any = {}
    if (user.role === 'SELLER') {
      query.sellerId = user.id
    }

    const stocks = await db.stock.findMany({
      where: query,
      include: {
        product: true
      },
      orderBy: { product: { name: 'asc' } }
    })

    // Filter low stock if requested
    const filteredStocks = alertOnly 
      ? stocks.filter(s => s.quantity <= s.alertLevel)
      : stocks

    return NextResponse.json({ stocks: filteredStocks })
  } catch (error) {
    console.error('Fetch Stock Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, quantity, alertLevel, note } = body

    if (!id) {
      return NextResponse.json({ error: 'Stock ID missing' }, { status: 400 })
    }

    const stock = await db.stock.findUnique({ where: { id } })
    if (!stock) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Only admin can adjust freely, or seller if allowed (assuming seller can only update alertLevel, not quantity)
    // Actually, usually sellers can update stock to sync if it's not strictly warehouse managed.
    // Let's allow seller to update their own
    if (user.role === 'SELLER' && stock.sellerId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updateData: any = {}
    if (quantity !== undefined) updateData.quantity = parseInt(quantity, 10)
    if (alertLevel !== undefined) updateData.alertLevel = parseInt(alertLevel, 10)

    const updatedStock = await db.stock.update({
      where: { id },
      data: updateData,
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
    })

    // Broadcast low stock alert if quantity drops below threshold
    const newQuantity = quantity !== undefined ? parseInt(quantity, 10) : stock.quantity
    const threshold = alertLevel !== undefined ? parseInt(alertLevel, 10) : stock.alertLevel

    if (newQuantity <= threshold && newQuantity < stock.quantity) {
      await broadcastLowStockAlert({
        productId: updatedStock.product.id,
        productName: updatedStock.product.name,
        sku: updatedStock.product.sku || '',
        quantity: newQuantity,
        threshold: threshold,
        sellerId: updatedStock.product.sellerId,
        timestamp: new Date().toISOString()
      })
    }

    if (quantity !== undefined && quantity !== stock.quantity) {
      const type = quantity > stock.quantity ? 'IN' : 'OUT'
      const difference = Math.abs(quantity - stock.quantity)
      
      await db.stockMovement.create({
        data: {
          stockId: stock.id,
          type,
          quantity: difference,
          reason: note || 'Manual adjustment'
        }
      })

      await logActivity({
        userId: user.id,
        userRole: user.role,
        action: 'STOCK_MOVEMENT_LOGGED',
        targetId: stock.id,
        description: `Stock for product ${stock.productId} manually adjusted to ${quantity} (${type} ${difference})`,
      })
    }

    return NextResponse.json({ stock: updatedStock })
  } catch (error) {
    console.error('Update Stock Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
