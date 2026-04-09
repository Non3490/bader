/**
 * Import Script: Restore from production-export.json backup
 *
 * Run with: npm run db:import-backup
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

// Table import order (respecting foreign key dependencies)
const tableOrder = [
  'TenantSettings',
  'SystemSetting',
  'TwilioSettings',
  'CarrierSettings',
  'ExpenseType',
  'Zone',
  'DeliveryZone',
  'Warehouse',
  'User',
  'Admin',
  'ApiKey',
  'AgentSession',
  'Wallet',
  'ActivityLog',
  'Product',
  'CatalogProduct',
  'Stock',
  'StockSnapshot',
  'Customer',
  'Blacklist',
  'Order',
  'OrderItem',
  'OrderHistory',
  'CallLog',
  'CallRecording',
  'PhoneCallLog',
  'Expense',
  'Invoice',
  'InvoiceLineItem',
  'RemittanceLock',
  'WalletTransaction',
  'WithdrawalRequest',
  'Integration',
  'WebhookActivity',
  'GoogleSheet',
  'SourcingRequest',
  'CatalogFavorite',
  'Driver',
  'Delivery',
  'CashHandoff',
  'DeliveryLocation',
  'DeliveryFeeConfig',
  'Notification',
  'NotificationLog',
]

// Convert Prisma model names to camelCase for Prisma client
const toCamelCase = (str: string) => {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

// Transform data for Prisma (handle dates, booleans, etc.)
function transformRecord(record: any, tableName: string) {
  const transformed: any = {}

  for (const [key, value] of Object.entries(record)) {
    // Skip null values
    if (value === null || value === undefined) {
      continue
    }

    // Handle timestamps (Prisma exports them as numbers)
    if (key.includes('At') || key === 'createdAt' || key === 'updatedAt' || key === 'deletedAt' || key === 'lockedAt') {
      if (typeof value === 'number') {
        transformed[key] = new Date(value)
      } else {
        transformed[key] = value
      }
    }
    // Handle Boolean fields (Prisma exports them as 0/1 in SQLite)
    else if (
      key.startsWith('is') ||
      key.startsWith('has') ||
      key === 'isActive' ||
      key === 'trackInventory' ||
      key === 'authorizeOpen' ||
      key.includes('Enabled') ||
      key.includes('Disabled')
    ) {
      transformed[key] = Boolean(value)
    }
    // Handle Json fields
    else if (
      key === 'polygon' ||
      key === 'quantityPricing' ||
      key === 'images' ||
      key === 'receivedImages'
    ) {
      if (typeof value === 'string') {
        try {
          transformed[key] = JSON.parse(value)
        } catch {
          transformed[key] = value
        }
      } else {
        transformed[key] = value
      }
    }
    // Keep other fields as-is
    else {
      transformed[key] = value
    }
  }

  return transformed
}

async function importTable(tableName: string, data: any[]) {
  if (!data || data.length === 0) {
    console.log(`   ⏭️  Skipping ${tableName} (no data)`)
    return
  }

  try {
    console.log(`\n📥 Importing ${tableName} (${data.length} records)...`)

    const modelName = toCamelCase(tableName)
    const model = (prisma as any)[modelName]

    if (!model) {
      console.log(`   ⚠️  Model ${modelName} not found, skipping`)
      return
    }

    // Import in batches
    const batchSize = 50
    let imported = 0
    let errors = 0

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)

      try {
        // Use createMany for bulk insert (faster)
        await model.createMany({
          data: batch.map(r => transformRecord(r, tableName)),
          skipDuplicates: true,
        })
        imported += batch.length
      } catch (error: any) {
        // If createMany fails, try one by one
        for (const record of batch) {
          try {
            const transformed = transformRecord(record, tableName)
            await model.create({ data: transformed })
            imported++
          } catch (err: any) {
            if (err.code === 'P2002') {
              // Unique constraint - already exists
              imported++
            } else if (err.code === 'P2003') {
              // Foreign key constraint
            } else {
              errors++
              if (errors <= 3) {
                console.log(`      ⚠️  ${err.message.substring(0, 100)}`)
              }
            }
          }
        }
      }

      if ((i + batchSize) % 200 === 0 || i + batchSize >= data.length) {
        console.log(`   Progress: ${Math.min(i + batchSize, data.length)}/${data.length}`)
      }
    }

    console.log(`   ✅ ${tableName}: ${imported} imported, ${errors} errors`)

  } catch (error: any) {
    console.error(`   ❌ Error importing ${tableName}:`, error.message)
  }
}

async function main() {
  console.log('🚀 Starting database import from backup...\n')

  // Read the backup file
  const backupPath = join(process.cwd(), 'prisma', 'production-export.json')

  console.log(`📂 Reading backup from: ${backupPath}`)

  let backup: any

  try {
    const backupContent = readFileSync(backupPath, 'utf-8')
    backup = JSON.parse(backupContent)
    console.log(`✅ Backup loaded (exported at: ${backup.exportedAt})\n`)
  } catch (error: any) {
    console.error('❌ Error reading backup file:', error.message)
    process.exit(1)
  }

  // Get all tables from backup
  const tables = backup.tables || {}

  // Count total records
  let totalRecords = 0
  for (const tableName of tableOrder) {
    if (tables[tableName]) {
      totalRecords += tables[tableName].length
    }
  }

  console.log(`📊 Total records to import: ${totalRecords}\n`)

  // Import tables in order
  let importedTables = 0
  for (const tableName of tableOrder) {
    const tableData = tables[tableName]
    if (tableData && tableData.length > 0) {
      await importTable(tableName, tableData)
      importedTables++
    }
  }

  console.log(`\n✨ Import complete! Processed ${importedTables} tables.\n`)

  // Show record counts
  console.log('📊 Final record counts:')
  for (const tableName of tableOrder) {
    const modelName = toCamelCase(tableName)
    const model = (prisma as any)[modelName]

    if (model && tables[tableName]?.length > 0) {
      try {
        const count = await model.count()
        console.log(`   ${tableName}: ${tables[tableName].length} → ${count}`)
      } catch {
        // Skip if model doesn't exist or error
      }
    }
  }

  await prisma.$disconnect()
}

main()
  .catch((error) => {
    console.error('❌ Import failed:', error)
    process.exit(1)
  })
