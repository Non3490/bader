import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getLowStockAlertCount } from '@/lib/stock-alerts'

// GET /api/stock/alerts
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Admin sees all low stock, sellers see only theirs
    const where: any = user.role === 'ADMIN' ? {} : { sellerId: user.id }

    // First fetch all stocks for the user, then filter by alert level
    const allStocks = await db.stock.findMany({
      where: where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            seller: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    // Filter stocks where quantity <= alertLevel and sort by quantity (most critical first)
    const lowStocks = allStocks
      .filter(stock => stock.quantity <= stock.alertLevel)
      .sort((a, b) => a.quantity - b.quantity)

    const alertCount = user.role === 'ADMIN' ? null : await getLowStockAlertCount(user.id)

    return NextResponse.json({
      alerts: lowStocks.map(stock => ({
        stockId: stock.id,
        productId: stock.productId,
        productName: stock.product.name,
        productSku: stock.product.sku,
        sellerName: stock.product.seller.name,
        currentStock: stock.quantity,
        threshold: stock.alertLevel,
        deficit: stock.alertLevel - stock.quantity,
      })),
      totalCount: lowStocks.length,
      myAlertCount: alertCount,
    })
  } catch (error) {
    console.error('Stock alerts GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
