import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  readFromSheets,
  parseOrdersFromSheetData,
  parseStockFromSheetData,
  batchSyncOrderStatusesToSheets,
  syncStockToSheets,
  formatOrderForSheet,
  writeToSheets
} from '@/lib/google-sheets'

// Helper to update sheet sync status
async function updateSheetSyncStatus(sheetId: string, status: string, error?: string) {
  try {
    await db.googleSheet.update({
      where: { id: sheetId },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: status,
        lastSyncError: error
      }
    })
  } catch (err) {
    console.error('Failed to update sheet sync status:', err)
  }
}

/**
 * POST /api/google-sheets/sync - Perform sync operations
 *
 * Supported operations:
 * - 'pull': Read data from Sheets to database
 * - 'push': Write database changes to Sheets (write-back)
 * - 'push_orders': Push order status updates to Sheets
 * - 'push_stock': Push stock updates to Sheets
 * - 'test': Test connection and return sheet info
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { operation, spreadsheetId, sheetName, dryRun = false, sheetId } = body

    if (!operation) {
      return NextResponse.json({ error: 'Operation is required' }, { status: 400 })
    }

    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet ID is required' }, { status: 400 })
    }

    // Verify user has access to this spreadsheet
    const sheetIntegration = await db.googleSheet.findFirst({
      where: user.role === 'ADMIN'
        ? { spreadsheetId }
        : { sellerId: user.id, spreadsheetId }
    })

    if (!sheetIntegration) {
      return NextResponse.json({ error: 'Sheet not found or access denied' }, { status: 403 })
    }

    const finalSheetName = sheetName || sheetIntegration.sheetName

    switch (operation) {
      case 'test': {
        const data = await readFromSheets(spreadsheetId, finalSheetName)
        const rowCount = data.length
        const colCount = data[0]?.length || 0

        return NextResponse.json({
          success: true,
          sheetName: finalSheetName,
          rowCount,
          columnCount: colCount,
          headers: data[0] || []
        })
      }

      case 'pull_orders': {
        // Pull orders from Sheets to database
        if (sheetId) await updateSheetSyncStatus(sheetId, 'IN_PROGRESS')

        const data = await readFromSheets(spreadsheetId, finalSheetName)
        const orders = parseOrdersFromSheetData(data)

        const results = {
          processed: 0,
          created: 0,
          updated: 0,
          errors: [] as string[]
        }

        for (const orderData of orders) {
          results.processed++

          try {
            const trackingNumber = orderData.tracking_number || orderData.trackingnumber || orderData.tracking
            if (!trackingNumber) continue

            const existingOrder = await db.order.findUnique({
              where: { trackingNumber }
            })

            if (!existingOrder) {
              // Create new order
              if (dryRun) {
                results.created++
                continue
              }

              await db.$transaction(async (tx) => {
                // Find or create product
                let product
                const productName = orderData.product_name || orderData.product || orderData.productname || 'Unknown Product'
                const sku = orderData.sku || `AUTO-${trackingNumber.substring(0, 6).toUpperCase()}`

                product = await tx.product.findFirst({
                  where: { sellerId: sheetIntegration.sellerId, sku }
                })

                if (!product) {
                  product = await tx.product.create({
                    data: {
                      sellerId: sheetIntegration.sellerId,
                      sku,
                      name: productName,
                      costPrice: 0,
                      sellPrice: orderData.cod_amount || orderData.codamount || 0
                    }
                  })
                }

                // Create order
                await tx.order.create({
                  data: {
                    trackingNumber,
                    sellerId: sheetIntegration.sellerId,
                    recipientName: orderData.recipient_name || orderData.recipientname || '',
                    phone: orderData.phone || '',
                    address: orderData.address || '',
                    city: orderData.city || '',
                    codAmount: orderData.cod_amount || orderData.codamount || 0,
                    status: orderData.status || 'NEW',
                    source: 'SHEETS',
                    items: {
                      create: [{
                        productId: product.id,
                        quantity: orderData.quantity || 1,
                        unitPrice: orderData.cod_amount || orderData.codamount || 0
                      }]
                    },
                    history: {
                      create: {
                        newStatus: orderData.status || 'NEW',
                        changedById: sheetIntegration.sellerId,
                        note: 'Imported from Google Sheets'
                      }
                    }
                  }
                })
              })
              results.created++
            } else {
              // Update existing order if newer
              const currentStatus = existingOrder.status
              const sheetStatus = orderData.status

              if (sheetStatus && sheetStatus !== currentStatus && !dryRun) {
                await db.order.update({
                  where: { id: existingOrder.id },
                  data: {
                    status: sheetStatus,
                    history: {
                      create: {
                        previousStatus: currentStatus,
                        newStatus: sheetStatus,
                        changedById: sheetIntegration.sellerId,
                        note: 'Status synced from Google Sheets'
                      }
                    }
                  }
                })
              }
              results.updated++
            }
          } catch (error) {
            results.errors.push(`Row ${orderData.rowIndex}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }

        if (sheetId) {
          await updateSheetSyncStatus(sheetId, 'SUCCESS')
        }

        return NextResponse.json({ success: true, results, lastSyncedAt: new Date().toISOString() })
      }

      case 'pull_stock': {
        // Pull stock data from Sheets to database
        const data = await readFromSheets(spreadsheetId, finalSheetName)
        const stocks = parseStockFromSheetData(data)

        const results = {
          processed: 0,
          created: 0,
          updated: 0,
          errors: [] as string[]
        }

        for (const stockData of stocks) {
          results.processed++

          try {
            const sku = stockData.sku
            const warehouse = stockData.warehouse || stockData.warehouse_name || stockData.warehousename || 'Main'
            const quantity = parseInt(stockData.quantity || stockData.qty || '0')

            if (!sku) continue

            const existingStock = await db.stock.findFirst({
              where: {
                sellerId: sheetIntegration.sellerId,
                productId: { sku }
              },
              include: { product: true }
            })

            if (!existingStock) {
              // Need product first
              if (dryRun) {
                results.created++
                continue
              }

              const productName = stockData.product_name || stockData.product || stockData.productname || 'Unknown Product'

              let product = await db.product.findFirst({
                where: { sellerId: sheetIntegration.sellerId, sku }
              })

              if (!product) {
                product = await db.product.create({
                  data: {
                    sellerId: sheetIntegration.sellerId,
                    sku,
                    name: productName,
                    costPrice: 0,
                    sellPrice: 0
                  }
                })
              }

              await db.stock.create({
                data: {
                  productId: product.id,
                  sellerId: sheetIntegration.sellerId,
                  warehouse,
                  quantity,
                  alertLevel: parseInt(stockData.alert_level || stockData.alertlevel || '5')
                }
              })
              results.created++
            } else {
              if (!dryRun) {
                await db.stock.update({
                  where: { id: existingStock.id },
                  data: { quantity }
                })
              }
              results.updated++
            }
          } catch (error) {
            results.errors.push(`Row ${stockData.rowIndex}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }

        return NextResponse.json({ success: true, results })
      }

      case 'push_orders': {
        // Push order status updates to Sheets (write-back)
        const statuses = body.statuses as Array<{ trackingNumber: string; status: string }>

        if (!statuses || statuses.length === 0) {
          return NextResponse.json({ error: 'Statuses array is required for push_orders' }, { status: 400 })
        }

        if (!dryRun) {
          await batchSyncOrderStatusesToSheets(spreadsheetId, statuses, finalSheetName)
        }

        return NextResponse.json({
          success: true,
          operation: 'push_orders',
          count: statuses.length,
          dryRun
        })
      }

      case 'push_stock': {
        // Push stock updates to Sheets (write-back)
        const stocks = body.stocks as Array<{ sku: string; quantity: number; warehouse: string }>

        if (!stocks || stocks.length === 0) {
          return NextResponse.json({ error: 'Stocks array is required for push_stock' }, { status: 400 })
        }

        if (!dryRun) {
          for (const stock of stocks) {
            await syncStockToSheets(
              spreadsheetId,
              stock.sku,
              stock.quantity,
              stock.warehouse || 'Main',
              finalSheetName
            )
          }
        }

        return NextResponse.json({
          success: true,
          operation: 'push_stock',
          count: stocks.length,
          dryRun
        })
      }

      case 'push_all_orders': {
        // Push all seller's orders to Sheets
        const sellerOrders = await db.order.findMany({
          where: {
            sellerId: sheetIntegration.sellerId,
            createdAt: body.since
              ? { gte: new Date(body.since) }
              : undefined
          },
          include: { items: { include: { product: true } } },
          orderBy: { createdAt: 'desc' }
        })

        const sheetData = sellerOrders.map(order => formatOrderForSheet({
          ...order,
          productName: order.items[0]?.product?.name || 'Unknown',
          quantity: order.items[0]?.quantity || 1
        }))

        if (!dryRun) {
          // Get current sheet data to preserve header
          const currentData = await readFromSheets(spreadsheetId, finalSheetName)
          const headerRow = currentData[0] || [
            'Tracking Number', 'Recipient Name', 'Phone', 'Address', 'City',
            'COD Amount', 'Status', 'Source', 'Product Name', 'Quantity',
            'Delivered At', 'Notes'
          ]

          // Write header + all data
          await writeToSheets(
            spreadsheetId,
            finalSheetName,
            'A1',
            [headerRow, ...sheetData],
            { clearExisting: true }
          )
        }

        return NextResponse.json({
          success: true,
          operation: 'push_all_orders',
          count: sheetData.length,
          dryRun
        })
      }

      default:
        return NextResponse.json({ error: `Unknown operation: ${operation}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Google Sheets Sync error:', error)

    // Update sync status to ERROR on failure
    if (sheetId) {
      await updateSheetSyncStatus(sheetId, 'ERROR', error instanceof Error ? error.message : 'Unknown error')
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
