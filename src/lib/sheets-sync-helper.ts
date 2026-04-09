/**
 * Helper functions for automatic Google Sheets sync
 * These functions are called by order and stock update APIs
 */

import { db } from '@/lib/db'
import { syncOrderStatusToSheets, syncStockToSheets } from '@/lib/google-sheets'

/**
 * Sync order status change to all connected Google Sheets for the seller
 * This is called automatically when order status changes
 */
export async function syncOrderStatusToConnectedSheets(
  sellerId: string,
  trackingNumber: string,
  status: string
): Promise<void> {
  try {
    const sheets = await db.googleSheet.findMany({
      where: { sellerId }
    })

    if (sheets.length === 0) return

    // Sync to all connected sheets in parallel
    await Promise.allSettled(
      sheets.map(sheet =>
        syncOrderStatusToSheets(sheet.spreadsheetId, trackingNumber, status, sheet.sheetName).catch(err => {
          console.error(`Failed to sync to sheet ${sheet.id}:`, err)
        })
      )
    )
  } catch (error) {
    console.error('Failed to sync order status to Google Sheets:', error)
    // Don't throw - sync failure shouldn't block order updates
  }
}

/**
 * Sync stock update to all connected Google Sheets for the seller
 */
export async function syncStockUpdateToConnectedSheets(
  sellerId: string,
  sku: string,
  quantity: number,
  warehouse: string
): Promise<void> {
  try {
    const sheets = await db.googleSheet.findMany({
      where: { sellerId }
    })

    if (sheets.length === 0) return

    await Promise.allSettled(
      sheets.map(sheet =>
        syncStockToSheets(sheet.spreadsheetId, sku, quantity, warehouse, sheet.sheetName).catch(err => {
          console.error(`Failed to sync stock to sheet ${sheet.id}:`, err)
        })
      )
    )
  } catch (error) {
    console.error('Failed to sync stock to Google Sheets:', error)
  }
}

/**
 * Check if a seller has Google Sheets integration
 */
export async function hasGoogleSheetsIntegration(sellerId: string): Promise<boolean> {
  const count = await db.googleSheet.count({
    where: { sellerId }
  })
  return count > 0
}
