import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import ExcelJS from 'exceljs'

/**
 * GET /api/finance/export
 * Export finance data to Excel
 */
export async function GET(request: NextRequest) {
  const user = await getSession()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const period = parseInt(searchParams.get('period') || '30') // days

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - period)
    startDate.setHours(0, 0, 0, 0)

    // Get invoices
    const invoices = await db.invoice.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { select: { name: true, email: true } },
        deliveryMan: { select: { name: true } }
      }
    })

    // Get orders for revenue calculation
    const orders = await db.order.findMany({
      where: {
        status: 'DELIVERED',
        updatedAt: { gte: startDate }
      },
      select: {
        codAmount: true,
        createdAt: true,
        sellerId: true
      }
    })

    const totalRevenue = orders.reduce((sum, o) => sum + o.codAmount, 0)

    // Create workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Finance Report')

    // Add summary section
    worksheet.addRow(['Finance Summary Report'])
    worksheet.addRow([])
    worksheet.addRow(['Report Period', `${startDate.toLocaleDateString()} - ${new Date().toLocaleDateString()}`])
    worksheet.addRow(['Total Revenue', totalRevenue.toFixed(2) + ' XAF'])
    worksheet.addRow(['Total Invoices', invoices.length])
    worksheet.addRow([])

    // Define columns for invoices table
    worksheet.columns = [
      { header: 'Invoice Ref', key: 'ref', width: 18 },
      { header: 'Type', key: 'cycleType', width: 15 },
      { header: 'Date', key: 'createdAt', width: 15 },
      { header: 'Seller/Delivery Man', key: 'party', width: 25 },
      { header: 'Cash Collected', key: 'cashCollected', width: 15 },
      { header: 'Refunded', key: 'refundedAmount', width: 12 },
      { header: 'Subtotal', key: 'subtotal', width: 12 },
      { header: 'VAT', key: 'vat', width: 10 },
      { header: 'Total Net', key: 'totalNet', width: 12 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Locked', key: 'isLocked', width: 10 }
    ]

    // Style header
    const headerRow = worksheet.getRow(6)
    headerRow.font = { bold: true, size: 11 }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4ADE80' }
    }

    // Add invoice data
    invoices.forEach(invoice => {
      const party = invoice.cycleType === 'DELIVERY'
        ? invoice.deliveryMan?.name || 'N/A'
        : invoice.seller?.name || 'N/A'

      worksheet.addRow({
        ref: invoice.ref,
        cycleType: invoice.cycleType,
        createdAt: new Date(invoice.createdAt).toLocaleDateString(),
        party,
        cashCollected: invoice.cashCollected,
        refundedAmount: invoice.refundedAmount,
        subtotal: invoice.subtotal,
        vat: invoice.vat,
        totalNet: invoice.totalNet,
        status: invoice.status,
        isLocked: invoice.isLocked ? 'Yes' : 'No'
      })
    })

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="finance-export-${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    })
  } catch (error) {
    console.error('Finance export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
