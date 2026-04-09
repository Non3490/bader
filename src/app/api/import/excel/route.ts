import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import ExcelJS from 'exceljs'

interface ExcelRow {
  customerName?: string
  phone?: string
  city?: string
  address?: string
  productName?: string
  quantity?: number
  codAmount?: number
  notes?: string
}

// POST to upload and validate Excel file
export async function POST(req: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.endsWith('.xlsx')) {
      return NextResponse.json({ error: 'File must be an .xlsx file' }, { status: 400 })
    }

    // Read file
    const buffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      return NextResponse.json({ error: 'Invalid Excel file - no worksheet found' }, { status: 400 })
    }

    // Skip instruction rows (first 2 rows), header is row 3
    const dataRows: ExcelRow[] = []
    const errors: { row: number; column: string; error: string }[] = []
    const warnings: { row: number; message: string }[] = []

    let rowIndex = 0
    worksheet.eachRow((row, rowNumber) => {
      // Skip instruction rows (1-2) and header row (3)
      if (rowNumber <= 3) return

      const rowData: ExcelRow = {
        customerName: row.getCell(1).text?.trim(),
        phone: row.getCell(2).text?.trim(),
        city: row.getCell(3).text?.trim(),
        address: row.getCell(4).text?.trim(),
        productName: row.getCell(5).text?.trim(),
        quantity: row.getCell(6).value as number,
        codAmount: row.getCell(7).value as number,
        notes: row.getCell(8).text?.trim()
      }

      // Skip completely empty rows
      if (!rowData.customerName && !rowData.phone && !rowData.city) {
        return
      }

      // Validation
      const rowErrors: { column: string; error: string }[] = []

      if (!rowData.customerName) rowErrors.push({ column: 'Customer Name', error: 'Required' })
      if (!rowData.phone) rowErrors.push({ column: 'Phone', error: 'Required' })
      if (!rowData.city) rowErrors.push({ column: 'City', error: 'Required' })
      if (!rowData.address) rowErrors.push({ column: 'Address', error: 'Required' })
      if (!rowData.productName) rowErrors.push({ column: 'Product Name', error: 'Required' })
      if (rowData.codAmount === undefined || rowData.codAmount === null) {
        rowErrors.push({ column: 'COD Amount', error: 'Required' })
      }

      // Phone format validation
      if (rowData.phone) {
        const phone = rowData.phone.replace(/\D/g, '')
        if (phone.length < 8) {
          rowErrors.push({ column: 'Phone', error: 'Must be at least 8 digits' })
        }
      }

      // Quantity validation
      if (rowData.quantity === undefined || rowData.quantity === null || rowData.quantity <= 0) {
        rowErrors.push({ column: 'Quantity', error: 'Must be positive' })
      }

      // COD Amount validation
      if (rowData.codAmount !== undefined && rowData.codAmount !== null && rowData.codAmount < 0) {
        rowErrors.push({ column: 'COD Amount', error: 'Must be positive' })
      }

      // City validation (Gabon cities)
      const validCities = [
        'Libreville', 'Port-Gentil', 'Franceville', 'Oyem', 'Moanda',
        'Mouila', 'Lambaréné', 'Tchibanga', 'Koulamoutou', 'Makokou',
        'Bitam', 'Gamba', 'Mbigou', 'Lastoursville', 'Ntoum'
      ]
      if (rowData.city && !validCities.includes(rowData.city)) {
        warnings.push({
          row: rowNumber - 2, // Adjust for display (skip instructions)
          message: `City "${rowData.city}" not in standard list`
        })
      }

      // Add errors to main list
      rowErrors.forEach(err => {
        errors.push({
          row: rowNumber - 2,
          column: err.column,
          error: err.error
        })
      })

      dataRows.push({
        ...rowData,
        quantity: rowData.quantity || 1,
        codAmount: rowData.codAmount || 0
      })

      rowIndex++
    })

    // If any errors, reject entire file
    if (errors.length > 0) {
      return NextResponse.json({
        error: 'Validation failed - file rejected',
        errors,
        totalRows: dataRows.length
      }, { status: 400 })
    }

    // Check for duplicates (phone + city)
    const duplicateChecks = await Promise.all(
      dataRows.map(async (row, idx) => {
        const phone = row.phone?.replace(/\D/g, '') || ''
        const existing = await db.order.findFirst({
          where: {
            phone,
            city: row.city || '',
            source: 'EXCEL'
          }
        })
        return {
          row: idx + 1,
          customerName: row.customerName,
          isDuplicate: !!existing,
          existingTracking: existing?.trackingNumber
        }
      })
    )

    const duplicates = duplicateChecks.filter(d => d.isDuplicate)

    return NextResponse.json({
      success: true,
      totalRows: dataRows.length,
      preview: dataRows.slice(0, 5).map((row, idx) => ({
        rowNumber: idx + 1,
        customerName: row.customerName,
        phone: row.phone?.replace(/\D/g, '') || '',
        city: row.city,
        address: row.address,
        productName: row.productName,
        quantity: row.quantity,
        codAmount: row.codAmount,
        notes: row.notes || ''
      })),
      duplicates: duplicates,
      warnings: warnings.length > 0 ? warnings : undefined,
      duplicateWarning: duplicates.length > 0
        ? `Found ${duplicates.length} potential duplicate(s) that will be skipped on import`
        : undefined
    })
  } catch (error) {
    console.error('[Import:Excel] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// CONFIRM import - actually create the orders
export async function PUT(req: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { rows } = body

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
    }

    const results = {
      created: 0,
      duplicates: 0,
      errors: [] as { row: number; error: string }[]
    }

    for (const row of rows) {
      try {
        const phone = row.phone?.replace(/\D/g, '') || ''

        // Check for duplicate
        const existing = await db.order.findFirst({
          where: {
            phone,
            city: row.city,
            source: 'EXCEL'
          }
        })

        if (existing) {
          results.duplicates++
          continue
        }

        // Generate tracking number
        const trackingNumber = `GAB-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999) + 1).padStart(6, '0')}`

        // Create order
        await db.order.create({
          data: {
            trackingNumber,
            sellerId: user.id,
            recipientName: row.customerName,
            phone: phone,
            address: row.address,
            city: row.city,
            codAmount: row.codAmount || 0,
            quantity: row.quantity || 1,
            note: row.notes || null,
            source: 'EXCEL',
            status: 'NEW'
          }
        })

        results.created++
      } catch (error) {
        console.error(`[Import:Excel] Error creating order for row ${row.rowNumber}:`, error)
        results.errors.push({ row: row.rowNumber, error: 'Failed to create order' })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('[Import:Excel] Confirm error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
