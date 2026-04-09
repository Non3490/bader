/**
 * Google Sheets 2-Way Sync Service
 * Provides bidirectional synchronization between the database and Google Sheets
 *
 * Supported Operations:
 * - Read: Pull orders/stock data from Sheets
 * - Write: Push order status/stock updates back to Sheets
 * - Sync: Two-way synchronization with conflict resolution
 */

import { google } from 'googleapis'
import { JWT } from 'google-auth-library'

// Environment variable validation
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_SHEETS_CLIENT_EMAIL
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n')

// Cache for authenticated clients
const sheetsClientCache = new Map<string, ReturnType<typeof google.sheets>>()

/**
 * Get authenticated Google Sheets client
 */
export async function getSheetsClient(spreadsheetId?: string) {
  const cacheKey = spreadsheetId || 'default'

  if (sheetsClientCache.has(cacheKey)) {
    return sheetsClientCache.get(cacheKey)!
  }

  if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error('Google Sheets credentials not configured. Set GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY.')
  }

  const auth = new JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })

  await auth.authorize()

  const sheets = google.sheets({ version: 'v4', auth })
  sheetsClientCache.set(cacheKey, sheets)

  return sheets
}

/**
 * Column mapping for different sheet types
 */
export const SHEET_MAPPINGS = {
  ORDERS: {
    TRACKING_NUMBER: 'A',
    RECIPIENT_NAME: 'B',
    PHONE: 'C',
    ADDRESS: 'D',
    CITY: 'E',
    COD_AMOUNT: 'F',
    STATUS: 'G',
    SOURCE: 'H',
    PRODUCT_NAME: 'I',
    QUANTITY: 'J',
    DELIVERED_AT: 'K',
    NOTES: 'L',
    ROW_ID: 'M' // Internal tracking
  },
  STOCK: {
    SKU: 'A',
    PRODUCT_NAME: 'B',
    WAREHOUSE: 'C',
    QUANTITY: 'D',
    ALERT_LEVEL: 'E',
    LAST_UPDATED: 'F',
    ROW_ID: 'G'
  },
  PRODUCTS: {
    SKU: 'A',
    NAME: 'B',
    COST_PRICE: 'C',
    SELL_PRICE: 'D',
    IS_ACTIVE: 'E',
    ROW_ID: 'F'
  }
} as const

/**
 * Read data from a Google Sheet
 */
export async function readFromSheets(
  spreadsheetId: string,
  sheetName: string,
  range?: string
): Promise<any[][]> {
  try {
    const sheets = await getSheetsClient(spreadsheetId)
    const actualRange = range || `${sheetName}!A1:Z`

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: actualRange
    })

    return response.data.values || []
  } catch (error) {
    console.error('Google Sheets read error:', error)
    throw new Error(`Failed to read from sheet: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Write data to a Google Sheet
 */
export async function writeToSheets(
  spreadsheetId: string,
  sheetName: string,
  range: string,
  values: any[][],
  options: {
    clearExisting?: boolean
    append?: boolean
  } = {}
): Promise<void> {
  try {
    const sheets = await getSheetsClient(spreadsheetId)

    if (options.clearExisting) {
      // Clear existing data first
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!${range}`
      })
    }

    if (options.append) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!${range}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values
        }
      })
    } else {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!${range}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values
        }
      })
    }
  } catch (error) {
    console.error('Google Sheets write error:', error)
    throw new Error(`Failed to write to sheet: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Update specific cells in a Google Sheet (for status updates)
 */
export async function updateSheetCells(
  spreadsheetId: string,
  sheetName: string,
  updates: Array<{ row: number; column: string; value: any }>
): Promise<void> {
  try {
    const sheets = await getSheetsClient(spreadsheetId)

    const data: Array<{ range: string; values: any[][] }> = []

    for (const update of updates) {
      const cell = `${update.column}${update.row}`
      data.push({
        range: `${sheetName}!${cell}:${cell}`,
        values: [[update.value]]
      })
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data
      }
    })
  } catch (error) {
    console.error('Google Sheets update error:', error)
    throw new Error(`Failed to update sheet cells: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get or create a sheet in the spreadsheet
 */
export async function getOrCreateSheet(
  spreadsheetId: string,
  sheetName: string,
  headers: string[]
): Promise<void> {
  try {
    const sheets = await getSheetsClient(spreadsheetId)

    // Check if sheet exists
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId
    })

    const existingSheet = spreadsheet.data.sheets?.find(
      sheet => sheet.properties?.title === sheetName
    )

    if (!existingSheet) {
      // Create new sheet with headers
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }
          ]
        }
      })

      // Write headers
      await writeToSheets(
        spreadsheetId,
        sheetName,
        'A1',
        [headers],
        { clearExisting: false }
      )
    }
  } catch (error) {
    console.error('Google Sheets create sheet error:', error)
    throw new Error(`Failed to create sheet: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Parse orders from Google Sheets data
 */
export function parseOrdersFromSheetData(data: any[][]) {
  if (data.length < 2) return []

  const headers = data[0].map(h => h?.toLowerCase().replace(/\s+/g, '_'))

  return data.slice(1).map((row, index) => {
    const order: any = { rowIndex: index + 2 } // +2 for header + 1-based index

    headers.forEach((header, i) => {
      const value = row[i]
      order[header] = value
    })

    return order
  }).filter(row => row.tracking_number || row.trackingnumber || row.tracking)
}

/**
 * Parse stock data from Google Sheets
 */
export function parseStockFromSheetData(data: any[][]) {
  if (data.length < 2) return []

  const headers = data[0].map(h => h?.toLowerCase().replace(/\s+/g, '_'))

  return data.slice(1).map((row, index) => {
    const stock: any = { rowIndex: index + 2 }

    headers.forEach((header, i) => {
      stock[header] = row[i]
    })

    return stock
  }).filter(row => row.sku)
}

/**
 * Format order data for Google Sheets
 */
export function formatOrderForSheet(order: any) {
  return [
    order.trackingNumber,
    order.recipientName,
    order.phone,
    order.address,
    order.city,
    order.codAmount,
    order.status,
    order.source,
    order.productName || '',
    order.quantity || 1,
    order.deliveredAt ? new Date(order.deliveredAt).toISOString().split('T')[0] : '',
    order.note || ''
  ]
}

/**
 * Sync order status to Google Sheets (write-back)
 */
export async function syncOrderStatusToSheets(
  spreadsheetId: string,
  trackingNumber: string,
  status: string,
  sheetName: string = 'Orders'
): Promise<void> {
  try {
    const data = await readFromSheets(spreadsheetId, sheetName)
    const orders = parseOrdersFromSheetData(data)

    // Find the row with matching tracking number
    const targetRow = orders.find(
      (order: any) =>
        order.tracking_number === trackingNumber ||
        order.trackingnumber === trackingNumber ||
        order.tracking === trackingNumber
    )

    if (!targetRow) {
      console.warn(`Order ${trackingNumber} not found in sheet ${sheetName}`)
      return
    }

    // Update status column (column G in standard mapping)
    await updateSheetCells(
      spreadsheetId,
      sheetName,
      [
        {
          row: targetRow.rowIndex,
          column: 'G',
          value: status
        }
      ]
    )
  } catch (error) {
    console.error('Failed to sync order status to sheets:', error)
    throw error
  }
}

/**
 * Batch sync multiple order statuses to Google Sheets
 */
export async function batchSyncOrderStatusesToSheets(
  spreadsheetId: string,
  updates: Array<{ trackingNumber: string; status: string }>,
  sheetName: string = 'Orders'
): Promise<void> {
  try {
    const data = await readFromSheets(spreadsheetId, sheetName)
    const orders = parseOrdersFromSheetData(data)

    const cellUpdates: Array<{ row: number; column: string; value: any }> = []

    for (const update of updates) {
      const targetRow = orders.find(
        (order: any) =>
          order.tracking_number === update.trackingNumber ||
          order.trackingnumber === update.trackingNumber ||
          order.tracking === update.trackingNumber
      )

      if (targetRow) {
        cellUpdates.push({
          row: targetRow.rowIndex,
          column: 'G',
          value: update.status
        })
      }
    }

    if (cellUpdates.length > 0) {
      await updateSheetCells(spreadsheetId, sheetName, cellUpdates)
    }
  } catch (error) {
    console.error('Failed to batch sync order statuses to sheets:', error)
    throw error
  }
}

/**
 * Sync stock levels to Google Sheets (write-back)
 */
export async function syncStockToSheets(
  spreadsheetId: string,
  sku: string,
  quantity: number,
  warehouse: string,
  sheetName: string = 'Stock'
): Promise<void> {
  try {
    const data = await readFromSheets(spreadsheetId, sheetName)
    const stocks = parseStockFromSheetData(data)

    // Find the row with matching SKU and warehouse
    const targetRow = stocks.find(
      (stock: any) => stock.sku === sku && stock.warehouse === warehouse
    )

    if (!targetRow) {
      // Add new stock entry
      await writeToSheets(
        spreadsheetId,
        sheetName,
        `A${stocks.length + 2}`,
        [[sku, '', warehouse, quantity, 5, new Date().toISOString().split('T')[0]]],
        { append: false }
      )
      return
    }

    // Update quantity column (column D in standard mapping)
    await updateSheetCells(
      spreadsheetId,
      sheetName,
      [
        {
          row: targetRow.rowIndex,
          column: 'D',
          value: quantity
        },
        {
          row: targetRow.rowIndex,
          column: 'F',
          value: new Date().toISOString().split('T')[0]
        }
      ]
    )
  } catch (error) {
    console.error('Failed to sync stock to sheets:', error)
    throw error
  }
}

/**
 * Test Google Sheets connection
 */
export async function testSheetsConnection(
  spreadsheetId: string
): Promise<{ success: boolean; message: string; sheetNames?: string[] }> {
  try {
    const sheets = await getSheetsClient(spreadsheetId)
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId
    })

    const sheetNames = spreadsheet.data.sheets?.map(
      sheet => sheet.properties?.title
    ).filter(Boolean) as string[]

    return {
      success: true,
      message: 'Successfully connected to Google Sheets',
      sheetNames
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed'
    }
  }
}
