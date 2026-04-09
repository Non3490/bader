import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { deductStockForOrder } from '@/lib/stock-service'
import Papa from 'papaparse'

interface CsvRow {
  'Customer Name'?: string
  'Phone'?: string
  'City'?: string
  'Address'?: string
  'Product Name'?: string
  'Quantity'?: string
  'COD Amount'?: string
  'Notes'?: string
}

// POST to import CSV file
export async function POST(req: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    }

    // Read file content
    const text = await file.text()

    // Parse CSV
    const parseResult = Papa.parse<CsvRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim()
    })

    if (parseResult.errors.length > 0) {
      return NextResponse.json({
        error: 'CSV parsing failed',
        errors: parseResult.errors.map(e => `Row ${e.row}: ${e.message}`)
      }, { status: 400 })
    }

    const rows = parseResult.data
    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 })
    }

    // Validate and preview first 5 rows
    const preview: any[] = []
    const errors: { row: number; field: string; error: string }[] = []

    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const row = rows[i]
      const rowErrors: string[] = []

      // Required fields validation
      if (!row['Customer Name']?.trim()) rowErrors.push('Customer Name is required')
      if (!row['Phone']?.trim()) rowErrors.push('Phone is required')
      if (!row['City']?.trim()) rowErrors.push('City is required')
      if (!row['Address']?.trim()) rowErrors.push('Address is required')
      if (!row['Product Name']?.trim()) rowErrors.push('Product Name is required')
      if (!row['COD Amount']) rowErrors.push('COD Amount is required')

      // Phone format validation
      const phone = row['Phone']?.replace(/\D/g, '') || ''
      if (phone.length < 8) rowErrors.push('Phone number too short')

      // COD Amount validation
      const codAmount = parseFloat(row['COD Amount'] || '0')
      if (isNaN(codAmount) || codAmount < 0) rowErrors.push('COD Amount must be a positive number')

      if (rowErrors.length > 0) {
        rowErrors.forEach(err => errors.push({ row: i + 1, field: 'validation', error: err }))
      }

      preview.push({
        rowNumber: i + 1,
        customerName: row['Customer Name']?.trim() || '',
        phone: phone,
        city: row['City']?.trim() || '',
        address: row['Address']?.trim() || '',
        productName: row['Product Name']?.trim() || '',
        quantity: parseInt(row['Quantity'] || '1') || 1,
        codAmount: codAmount,
        notes: row['Notes']?.trim() || '',
        valid: rowErrors.length === 0
      })
    }

    if (errors.length > 0) {
      return NextResponse.json({
        error: 'Validation failed',
        errors,
        preview
      }, { status: 400 })
    }

    // Check for duplicates (phone + city)
    const duplicateChecks = await Promise.all(
      preview.map(async (p) => {
        const existing = await db.order.findFirst({
          where: {
            phone: p.phone,
            city: p.city,
            source: 'CSV'
          }
        })
        return {
          row: p.rowNumber,
          isDuplicate: !!existing,
          existingTracking: existing?.trackingNumber
        }
      })
    )

    const duplicates = duplicateChecks.filter(d => d.isDuplicate)

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      preview,
      duplicates: duplicates.map(d => ({
        ...d,
        customerName: preview.find(p => p.rowNumber === d.row)?.customerName
      })),
      warnings: duplicates.length > 0
        ? [`Found ${duplicates.length} potential duplicate(s) that will be skipped on import`]
        : []
    })
  } catch (error) {
    console.error('[Import:CSV] error:', error)
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
        // Check for duplicate
        const existing = await db.order.findFirst({
          where: {
            phone: row.phone,
            city: row.city,
            source: 'CSV'
          }
        })

        if (existing) {
          results.duplicates++
          continue
        }

        // Generate tracking number
        const trackingNumber = `GAB-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999) + 1).padStart(6, '0')}`

        // Create order
        const newOrder = await db.order.create({
          data: {
            trackingNumber,
            sellerId: user.id,
            recipientName: row.customerName,
            phone: row.phone,
            address: row.address,
            city: row.city,
            codAmount: row.codAmount,
            quantity: row.quantity || 1,
            note: row.notes || null,
            source: 'CSV',
            status: 'NEW'
          }
        })

        deductStockForOrder(newOrder.id, {
          reason: 'CSV import order confirmed',
          performedBy: 'SYSTEM'
        }).catch(err => console.error('Stock deduction failed for CSV order:', err))

        results.created++
      } catch (error) {
        console.error(`[Import:CSV] Error creating order for row ${row.rowNumber}:`, error)
        results.errors.push({ row: row.rowNumber, error: 'Failed to create order' })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('[Import:CSV] Confirm error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
