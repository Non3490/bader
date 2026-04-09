import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { exportStockMovements } from '@/lib/stock-service'

/**
 * GET /api/admin/inventory/movements - Get stock movement history
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const productId = searchParams.get('productId')
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const exportFormat = searchParams.get('export') // 'csv'

    const where: any = {}

    if (productId) {
      // Find stock records for this product
      const stocks = await db.stock.findMany({
        where: { productId },
        select: { id: true }
      })
      where.stockId = { in: stocks.map(s => s.id) }
    }

    if (type) {
      where.type = type
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

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
      take: 100
    })

    // Export to CSV if requested
    if (exportFormat === 'csv') {
      const csvData = await exportStockMovements({
        productId: productId || undefined,
        type: type || undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      })

      // Format CSV
      const headers = ['Date', 'Product', 'SKU', 'Type', 'Quantity', 'Balance After', 'Reason', 'Performed By', 'Order', 'Cost Per Unit']
      const rows = csvData.map(m => [
        new Date(m.date).toLocaleString('fr-FR'),
        m.product,
        m.sku,
        m.type,
        m.quantity,
        m.balanceAfter,
        m.reason,
        m.performedBy,
        m.orderTrackingNumber,
        m.costPerUnit
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="stock-movements-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    return NextResponse.json({
      movements: movements.map(m => ({
        id: m.id,
        date: m.createdAt,
        product: m.stock?.product?.name || 'N/A',
        productId: m.stock?.product?.id,
        sku: m.stock?.product?.sku || 'N/A',
        type: m.type,
        quantity: m.quantity,
        balanceAfter: m.balanceAfter,
        reason: m.reason,
        performedBy: m.admin?.name || m.user?.name || 'SYSTEM',
        performedByType: m.adminId ? 'ADMIN' : m.userId ? 'USER' : 'SYSTEM',
        orderTrackingNumber: m.order?.trackingNumber,
        costPerUnit: m.costPerUnit
      }))
    })
  } catch (error) {
    console.error('Stock movements GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
