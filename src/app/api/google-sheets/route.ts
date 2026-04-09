import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  testSheetsConnection,
  getOrCreateSheet,
  writeToSheets,
  readFromSheets,
  formatOrderForSheet,
  syncOrderStatusToSheets,
  syncStockToSheets,
  batchSyncOrderStatusesToSheets
} from '@/lib/google-sheets'

/**
 * GET /api/google-sheets - List all Google Sheets integrations
 */
export async function GET() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sheets = await db.googleSheet.findMany({
      where: user.role === 'ADMIN' ? {} : { sellerId: user.id },
      include: { seller: { select: { name: true, email: true } } }
    })

    return NextResponse.json({ sheets })
  } catch (error) {
    console.error('Google Sheets GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * POST /api/google-sheets - Add new Google Sheets integration
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { spreadsheetId, sheetName, sellerId } = body
    const targetSellerId = (user.role === 'ADMIN' && sellerId) ? sellerId : user.id

    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet ID is required' }, { status: 400 })
    }

    // Test connection first
    const connectionTest = await testSheetsConnection(spreadsheetId)
    if (!connectionTest.success) {
      return NextResponse.json(
        { error: 'Failed to connect to Google Sheets', details: connectionTest.message },
        { status: 400 }
      )
    }

    // Create sheet if not exists
    const finalSheetName = sheetName || 'Orders'
    await getOrCreateSheet(
      spreadsheetId,
      finalSheetName,
      ['Tracking Number', 'Recipient Name', 'Phone', 'Address', 'City', 'COD Amount', 'Status', 'Source', 'Product Name', 'Quantity', 'Delivered At', 'Notes']
    )

    // Check for existing integration
    const existing = await db.googleSheet.findFirst({
      where: { sellerId: targetSellerId, spreadsheetId }
    })

    let sheet

    if (existing) {
      // Update existing
      sheet = await db.googleSheet.update({
        where: { id: existing.id },
        data: { sheetName: finalSheetName }
      })
    } else {
      // Create new
      sheet = await db.googleSheet.create({
        data: {
          sellerId: targetSellerId,
          spreadsheetId,
          sheetName: finalSheetName
        }
      })
    }

    return NextResponse.json({
      sheet,
      connection: connectionTest
    }, { status: 201 })
  } catch (error) {
    console.error('Google Sheets POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
