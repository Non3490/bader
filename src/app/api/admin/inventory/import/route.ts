import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { parseCsv, validateStockImport, processStockImport, generateStockImportTemplate } from '@/lib/csv-validator'

/**
 * GET /api/admin/inventory/import - Get CSV template
 */
export async function GET() {
  const template = generateStockImportTemplate()

  return new NextResponse(template, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="stock-import-template.csv"'
    }
  })
}

/**
 * POST /api/admin/inventory/import - Upload and validate CSV
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { csvContent, action } = body // action: 'validate' | 'process'

    if (!csvContent) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 })
    }

    // Parse CSV
    const rows = parseCsv(csvContent)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Le fichier est vide' }, { status: 400 })
    }

    // Validate required columns
    const firstRow = rows[0]
    const requiredColumns = ['sku', 'quantity', 'operation']
    const missingColumns = requiredColumns.filter(col => !firstRow.hasOwnProperty(col))

    if (missingColumns.length > 0) {
      return NextResponse.json({
        error: 'Colonnes manquantes',
        missingColumns
      }, { status: 400 })
    }

    // Validate rows
    const validationResult = await validateStockImport(rows)

    // Return validation results
    if (action === 'validate' || validationResult.summary.invalid > 0) {
      return NextResponse.json({
        validation: validationResult
      })
    }

    // Process valid rows
    if (action === 'process') {
      const validRows = validationResult.rows.filter(r => r.valid).map(r => ({
        rowNumber: r.rowNumber,
        data: r.data
      }))

      const processResult = await processStockImport(
        validRows,
        session.adminId,
        session.adminId
      )

      return NextResponse.json({
        validation: validationResult,
        process: processResult
      })
    }

    return NextResponse.json({
      validation: validationResult
    })
  } catch (error) {
    console.error('Stock import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
