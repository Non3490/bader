import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import ExcelJS from 'exceljs'
import { scopeByRole } from '@/lib/auth-guard'

/**
 * GET /api/orders/export
 * Export orders to Excel
 */
export async function GET(request: NextRequest) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const format = searchParams.get('format') || 'xlsx'

    if (format !== 'xlsx') {
      return NextResponse.json({ error: 'Only xlsx format is supported' }, { status: 400 })
    }

    const where: any = { ...scopeByRole(user.id, user.role, user.parentSellerId) }
    if (status) {
      where.status = status
    }

    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000, // Limit to prevent large exports
      include: {
        seller: { select: { name: true } },
        deliveryMan: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } }
          }
        }
      }
    })

    // Create workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Orders')

    // Define columns
    worksheet.columns = [
      { header: 'Tracking #', key: 'trackingNumber', width: 18 },
      { header: 'Customer Name', key: 'recipientName', width: 20 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'City', key: 'city', width: 15 },
      { header: 'COD Amount', key: 'codAmount', width: 12 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Seller', key: 'seller', width: 20 },
      { header: 'Delivery Man', key: 'deliveryMan', width: 15 },
      { header: 'Product', key: 'product', width: 25 },
      { header: 'Created Date', key: 'createdAt', width: 18 }
    ]

    // Add header row style
    worksheet.getRow(1).font = { bold: true, size: 11 }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE3F2FD' }
    }

    // Add data rows
    orders.forEach(order => {
      const productNames = order.items?.map(item => item.product?.name).join(', ') || 'N/A'

      worksheet.addRow({
        trackingNumber: order.trackingNumber,
        recipientName: order.recipientName,
        phone: order.phone,
        address: order.address,
        city: order.city,
        codAmount: order.codAmount,
        status: order.status,
        seller: order.seller?.name || 'N/A',
        deliveryMan: order.deliveryMan?.name || 'Unassigned',
        product: productNames,
        createdAt: new Date(order.createdAt).toLocaleDateString()
      })
    })

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.eachCell) {
        column.eachCell({ includeEmpty: true }, (cell) => {
          if (cell.value) {
            const length = String(cell.value).length
            column.width = Math.max(column.width || 10, length + 2)
          }
        })
      }
    })

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="orders-export-${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
