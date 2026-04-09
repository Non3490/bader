import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import ExcelJS from 'exceljs'

// GET to download the template
export async function GET() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Orders Import')

    // Define columns
    worksheet.columns = [
      { header: 'Customer Name', key: 'customerName', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'City', key: 'city', width: 15 },
      { header: 'Address', key: 'address', width: 35 },
      { header: 'Product Name', key: 'productName', width: 25 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'COD Amount', key: 'codAmount', width: 12 },
      { header: 'Notes', key: 'notes', width: 30 }
    ]

    // Instructions row (row 1)
    worksheet.insertRow(1, [
      'IMPORTANT: Fill rows 3+. Row 2 contains example data. Phone must be Gabon format (e.g., 011XX XX XX XX or 07XX XX XX XX). COD Amount in XAF. Required fields: Customer Name, Phone, City, Address, Product Name, COD Amount.'
    ])
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF4E8' }
    }
    worksheet.getRow(1).font = { size: 9, color: { argb: 'FF666666' } }
    worksheet.mergeCells('A1:H1')
    worksheet.getRow(1).height = 35

    // Example data row (row 2)
    worksheet.addRow({
      customerName: 'Jean-Pierre Mbou',
      phone: '011234567',
      city: 'Libreville',
      address: `123 Boulevard de l'Indépendance, Quartier Montagne Sainte`,
      productName: 'Wireless Earbuds Pro',
      quantity: 1,
      codAmount: 25000,
      notes: 'Leave at gate if no answer'
    })

    // Format header row (row 3 now after insert)
    const headerRow = worksheet.getRow(3)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF07020' }
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    headerRow.height = 22

    // Add data validation for City dropdown (Gabon cities)
    const cities = [
      'Libreville', 'Port-Gentil', 'Franceville', 'Oyem', 'Moanda',
      'Mouila', 'Lambaréné', 'Tchibanga', 'Koulamoutou', 'Makokou',
      'Bitam', 'Gamba', 'Mbigou', 'Lastoursville', 'Ntoum'
    ]

    for (let i = 4; i <= 100; i++) {
      const cityCell = worksheet.getCell(`C${i}`)
      cityCell.dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`"${cities.join(',')}"`],
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid City',
        error: 'Please select a city from the dropdown list'
      }
    }

    // Add data validation for Quantity (must be positive integer)
    for (let i = 4; i <= 100; i++) {
      const qtyCell = worksheet.getCell(`F${i}`)
      qtyCell.dataValidation = {
        type: 'whole',
        operator: 'greaterThan',
        formulae: ['0'],
        allowBlank: false,
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid Quantity',
        error: 'Quantity must be a positive whole number'
      }
    }

    // Add data validation for COD Amount (must be positive number)
    for (let i = 4; i <= 100; i++) {
      const amountCell = worksheet.getCell(`G${i}`)
      amountCell.dataValidation = {
        type: 'decimal',
        operator: 'greaterThan',
        formulae: ['0'],
        allowBlank: false,
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid Amount',
        error: 'COD Amount must be a positive number (XAF)'
      }
      amountCell.numFmt = '#,##0'
    }

    // Protect formulas and lock cells
    worksheet.protect('egabon2024', {
      selectLockedCells: false,
      selectUnlockedCells: true
    })

    // Unlock data cells (rows 4+)
    for (let row = 4; row <= 100; row++) {
      for (let col = 1; col <= 8; col++) {
        worksheet.getCell(row, col).protection = { locked: false }
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Return file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="egabon-orders-import-template.xlsx"'
      }
    })
  } catch (error) {
    console.error('[Import:ExcelTemplate] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
