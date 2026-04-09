import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import ExcelJS from 'exceljs'

export async function GET(request: Request) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Create a new workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Orders Import Template')

    // Row 1: Title
    worksheet.mergeCells('A1:I1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = 'Gabon COD Platform — Order Import Template'
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

    // Row 2: Instructions
    worksheet.mergeCells('A2:I2')
    const instructionCell = worksheet.getCell('A2')
    instructionCell.value = 'Fill in the order details below. Required fields: CustomerName, Phone, Address, City, ProductName, CODAmount'
    instructionCell.font = { size: 10, color: { argb: 'FF666666' } }
    instructionCell.alignment = { horizontal: 'center', vertical: 'middle' }

    // Row 3: Headers
    const headers = ['TrackingNumber', 'CustomerName', 'Phone', 'Address', 'City', 'ProductName', 'Quantity', 'CODAmount', 'Notes']
    const headerRow = worksheet.getRow(3)
    headerRow.values = headers
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B5563' } }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }

    // Set column widths
    worksheet.getColumn('A').width = 18 // TrackingNumber
    worksheet.getColumn('B').width = 20 // CustomerName
    worksheet.getColumn('C').width = 15 // Phone
    worksheet.getColumn('D').width = 30 // Address
    worksheet.getColumn('E').width = 15 // City
    worksheet.getColumn('F').width = 25 // ProductName
    worksheet.getColumn('G').width = 10 // Quantity
    worksheet.getColumn('H').width = 12 // CODAmount
    worksheet.getColumn('I').width = 30 // Notes

    // Row 4-5: Sample data
    const sampleData1 = ['TRK001', 'Jean Dupont', '+241 66 12 34 56', '123 Avenue de la République', 'Libreville', 'Montre Connectée Pro', '1', '45000', 'Appeler avant livraison']
    const sampleData2 = ['TRK002', 'Marie Kouma', '+241 77 98 76 54', '45 Boulevard du Port', 'Port-Gentil', 'Casque Audio Bluetooth', '2', '35000', '']
    worksheet.addRow(sampleData1)
    worksheet.addRow(sampleData2)

    // Style sample data rows
    [4, 5].forEach(rowNum => {
      const row = worksheet.getRow(rowNum)
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle' }
        cell.font = { color: { argb: 'FF374151' } }
      })
    })

    // Row 6: Empty separator
    worksheet.addRow([])
    worksheet.mergeCells('A6:I6')
    const separatorCell = worksheet.getCell('A6')
    separatorCell.value = '--- START YOUR DATA BELOW THIS LINE ---'
    separatorCell.font = { size: 9, color: { argb: 'FF999999' } }
    separatorCell.alignment = { horizontal: 'center' }

    // Row 7: Empty data row
    worksheet.addRow([])

    // Row 8: Validation rules
    worksheet.mergeCells('A8:I8')
    const validationCell = worksheet.getCell('A8')
    validationCell.value = 'VALIDATION: • CustomerName (required) • Phone (required) • Address (required) • City (required) • ProductName (required) • Quantity (number) • CODAmount (number)'
    validationCell.font = { size: 9, color: { argb: 'FF666666' } }
    validationCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }

    // Set row heights
    worksheet.getRow(1).height = 30
    worksheet.getRow(2).height = 25
    worksheet.getRow(3).height = 22
    worksheet.getRow(8).height = 30

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Return as downloadable file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="order-import-template-${Date.now()}.xlsx"`,
      },
    })
  } catch (error: unknown) {
    console.error('Template generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate template' },
      { status: 500 }
    )
  }
}
