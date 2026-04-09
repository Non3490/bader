import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { addStock, deductStock, setStock } from '@/lib/stock-service'

/**
 * GET /api/admin/inventory - Get all products with stock info
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const sellerId = searchParams.get('sellerId')
    const category = searchParams.get('category')
    const status = searchParams.get('status') // 'low', 'out', 'all'

    const where: any = {}
    if (sellerId) where.sellerId = sellerId
    if (category) where.category = category

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
        sellPrice: true,
        supplierName: true,
        supplierPhone: true,
        trackInventory: true,
        imageUrl: true,
        sellerId: true,
        seller: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Filter by stock status if specified
    let filteredProducts = products
    if (status === 'low') {
      filteredProducts = products.filter(p => p.currentStock > 0 && p.currentStock <= p.reorderPoint)
    } else if (status === 'out') {
      filteredProducts = products.filter(p => p.currentStock === 0)
    }

    // Calculate stock status for each product
    const productsWithStatus = filteredProducts.map(p => ({
      ...p,
      stockStatus: p.currentStock === 0 ? 'OUT' : p.currentStock <= p.reorderPoint ? 'LOW' : 'OK',
      stockValue: p.currentStock * p.costPrice
    }))

    // Calculate category summary
    const categorySummary = productsWithStatus.reduce((acc, p) => {
      const cat = p.category || 'Uncategorized'
      if (!acc[cat]) {
        acc[cat] = { totalStock: 0, totalValue: 0, productCount: 0, lowStockCount: 0 }
      }
      acc[cat].totalStock += p.currentStock
      acc[cat].totalValue += p.stockValue
      acc[cat].productCount += 1
      if (p.stockStatus !== 'OK') acc[cat].lowStockCount += 1
      return acc
    }, {} as Record<string, { totalStock: number; totalValue: number; productCount: number; lowStockCount: number }>)

    return NextResponse.json({
      products: productsWithStatus,
      summary: {
        totalProducts: products.length,
        lowStockCount: products.filter(p => p.currentStock > 0 && p.currentStock <= p.reorderPoint).length,
        outOfStockCount: products.filter(p => p.currentStock === 0).length,
        totalStockValue: products.reduce((sum, p) => sum + p.currentStock * p.costPrice, 0),
        categorySummary
      }
    })
  } catch (error) {
    console.error('Inventory GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/inventory - Manual stock adjustment
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { productId, operation, quantity, reason, costPerUnit, notes } = body

    if (!productId || !operation || quantity === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const options = {
      adminId: session.adminId,
      performedBy: session.adminId,
      reason: notes ? `${reason || ''} - ${notes}` : reason || operation,
      costPerUnit: operation === 'ADD' ? costPerUnit : undefined
    }

    let result
    switch (operation) {
      case 'ADD':
        result = await addStock(productId, quantity, undefined, options)
        break
      case 'REMOVE':
        result = await deductStock(productId, quantity, undefined, options)
        break
      case 'SET':
        result = await setStock(productId, quantity, undefined, options)
        break
      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        balanceAfter: result.balanceAfter
      })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('Inventory POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
