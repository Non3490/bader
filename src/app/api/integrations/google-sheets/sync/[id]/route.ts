import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'
import { google } from 'googleapis'

// Expected sheet columns (match import template)
const REQUIRED_COLUMNS = ['RECIPIENT', 'ADDRESS', 'CITY', 'NOTE', 'PHONE', 'AMOUNT', 'PRODUCT_REF', 'PRODUCT_QT', 'SYNC_STATUS', 'ORDER_CODE']

/**
 * POST /api/integrations/google-sheets/sync/[id]
 * Sync orders from Google Sheets
 * SELLER own integration only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user || (user.role !== 'SELLER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params

  try {
    // Get Google Sheet integration
    const sheet = await db.googleSheet.findUnique({
      where: { id },
      include: { seller: true }
    })

    if (!sheet) {
      return NextResponse.json({ error: 'Google Sheet not found' }, { status: 404 })
    }

    // SELLERs can only sync their own sheets
    if (user.role === 'SELLER' && sheet.sellerId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // Read all rows from sheet
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheet.spreadsheetId,
      range: `${sheet.sheetName}!A1:Z1000`
    })

    const values = sheetData.data.values || []
    if (values.length === 0) {
      return NextResponse.json({ imported: 0, message: 'No data found in sheet' })
    }

    const headers = values[0] || []
    const dataRows = values.slice(1)

    // Validate columns
    const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col))
    if (missingColumns.length > 0) {
      return NextResponse.json({
        error: 'Missing required columns',
        missingColumns,
        requiredColumns: REQUIRED_COLUMNS,
        foundColumns: headers
      }, { status: 400 })
    }

    let imported = 0
    let skipped = 0
    let errors = 0

    // Process each row
    for (const row of dataRows) {
      try {
        // Create column map
        const rowData = Object.fromEntries(headers.map((h, i) => [h, row[i]]))

        // Skip if already imported
        if (rowData.SYNC_STATUS === 'Imported') {
          skipped++
          continue
        }

        // Validate required fields
        if (!rowData.RECIPIENT || !rowData.PHONE || !rowData.AMOUNT) {
          errors++
          continue
        }

        // Normalize to order format
        const codAmount = parseFloat(rowData.AMOUNT) || 0
        const productQt = parseInt(rowData.PRODUCT_QT) || 1

        // Check if already exists by phone (simple deduplication)
        const existingOrder = await db.order.findFirst({
          where: {
            phone: rowData.PHONE,
            recipientName: rowData.RECIPIENT
          }
        })

        if (existingOrder) {
          errors++
          continue
        }

        // Create order
        const order = await db.order.create({
          data: {
            trackingNumber: `GS-${Date.now().toString(36).substring(2, 10).toUpperCase()}`,
            sellerId: user.role === 'SELLER' ? user.id : sheet.sellerId,
            recipientName: rowData.RECIPIENT || '',
            phone: rowData.PHONE || '',
            address: rowData.ADDRESS || '',
            city: rowData.CITY || '',
            note: rowData.NOTE || null,
            codAmount,
            status: 'NEW',
            source: 'SHEETS',
            groupId: sheet.id
          }
        })

        // Create order item if product info provided
        if (rowData.PRODUCT_REF) {
          // Find or create product
          let product = await db.product.findFirst({
            where: {
              sellerId: user.role === 'SELLER' ? user.id : sheet.sellerId,
              sku: rowData.PRODUCT_REF
            }
          })

          if (!product) {
            product = await db.product.create({
              data: {
                sellerId: user.role === 'SELLER' ? user.id : sheet.sellerId,
                sku: rowData.PRODUCT_REF,
                name: `Imported: ${rowData.PRODUCT_REF}`,
                costPrice: 0,
                sellPrice: 0
              }
            })
          }

          await db.orderItem.create({
            data: {
              orderId: order.id,
              productId: product.id,
              quantity: productQt,
              unitPrice: codAmount / productQt
            }
          })
        }

        // Update sheet row with import status
        const rowIndex = values.indexOf(row) + 2 // +1 for 0-index to 1-index, +1 for header row
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheet.spreadsheetId,
          range: `${sheet.sheetName}!A${rowIndex}:I${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[...Object.values(rowData), 'Imported', order.trackingNumber]]
          }
        })

        imported++
      } catch (error) {
        console.error('Error processing row:', error)
        errors++
      }
    }

    // Log activity
    await logActivity(
      user.id,
      user.role,
      'GOOGLE_SHEETS_SYNC',
      `Synced ${imported} orders from Google Sheet: ${sheet.sheetName}. Skipped: ${skipped}, Errors: ${errors}`
    )

    return NextResponse.json({
      imported,
      skipped,
      errors,
      message: `Imported ${imported} orders successfully. ${skipped} skipped, ${errors} errors.`
    })
  } catch (error) {
    console.error('Google Sheets sync error:', error)
    return NextResponse.json({ error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
