/**
 * Migration Script: SQLite/Old PostgreSQL → New PostgreSQL Database
 *
 * This script will:
 * 1. Connect to your OLD database (SQLite or PostgreSQL)
 * 2. Export all data
 * 3. Import to your NEW PostgreSQL database
 *
 * Run with: npx tsx prisma/migrate-to-new-db.ts
 */

import { PrismaClient } from '@prisma/client'

// OLD DATABASE - PostgreSQL (the one that hit quota)
const OLD_DB_URL = 'postgres://541202a28cef8873d7e6309416e12dad23822a6fcc84b48f86d7a4cc7708e807:sk_w_Zx6lm8va2_ZLzXfFWk-@db.prisma.io:5432/postgres?sslmode=require'

// NEW DATABASE - PostgreSQL (your new connection with fresh quota)
const NEW_DB_URL = 'postgres://0e025ba87d33aca9054d576c2869e16aa61a140a53b2167f3eec70dd51621a76:sk_CWGO_FZSf0z0NeUTJbkdY@db.prisma.io:5432/postgres?sslmode=require'

const oldPrisma = new PrismaClient({
  datasources: {
    db: {
      url: OLD_DB_URL,
    },
  },
})

const newPrisma = new PrismaClient({
  datasources: {
    db: {
      url: NEW_DB_URL,
    },
  },
})

// Models to migrate (in order to respect foreign keys)
const modelsToMigrate = [
  // Core models (no dependencies)
  'systemSetting',
  'tenantSettings',
  'twilioSettings',
  'carrierSettings',
  'expenseType',

  // User-related
  'user',
  'admin',
  'apiKey',
  'agentSession',
  'wallet',
  'activityLog',

  // Location & Zone
  'zone',
  'deliveryZone',
  'warehouse',

  // Products & Stock
  'product',
  'catalogProduct',
  'stock',
  'stockSnapshot',

  // Orders
  'customer',
  'blacklist',
  'order',
  'orderItem',
  'orderHistory',

  // Call Center
  'callLog',
  'callRecording',
  'phoneCallLog',

  // Finance
  'expense',
  'invoice',
  'invoiceLineItem',
  'remittanceLock',
  'walletTransaction',
  'withdrawalRequest',

  // Integration
  'integration',
  'webhookActivity',
  'googleSheet',

  // Sourcing
  'sourcingRequest',
  'catalogFavorite',

  // Delivery
  'driver',
  'delivery',
  'cashHandoff',
  'deliveryLocation',
  'deliveryFeeConfig',

  // Notifications
  'notification',
  'notificationLog',
]

async function migrateTable(tableName: string) {
  try {
    console.log(`\n📦 Migrating ${tableName}...`)

    // Get all records from old database
    // @ts-ignore - dynamic model access
    const records = await oldPrisma[tableName].findMany()

    if (records.length === 0) {
      console.log(`   ✅ No records to migrate`)
      return
    }

    console.log(`   Found ${records.length} records`)

    // Insert in batches to avoid overwhelming the new database
    const batchSize = 100
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)

      try {
        // @ts-ignore - dynamic model access
        await newPrisma[tableName].createMany({
          data: batch,
          skipDuplicates: true,
        })
        console.log(`   ✅ Migrated ${Math.min(i + batchSize, records.length)}/${records.length} records`)
      } catch (error: any) {
        console.log(`   ⚠️  Batch error: ${error.message}`)
        // Try inserting one by one if batch fails
        for (const record of batch) {
          try {
            // @ts-ignore - dynamic model access
            await newPrisma[tableName].create({
              data: record,
            })
          } catch (singleError: any) {
            console.log(`      ❌ Failed to insert record: ${singleError.message}`)
          }
        }
      }
    }

    console.log(`   ✅ ${tableName} migration complete`)
  } catch (error: any) {
    console.error(`   ❌ Error migrating ${tableName}:`, error.message)
  }
}

async function main() {
  console.log('🚀 Starting database migration...\n')
  console.log('Source:', OLD_DB_URL)
  console.log('Target:', NEW_DB_URL)

  // Test connections
  try {
    await oldPrisma.$connect()
    console.log('✅ Connected to OLD database')
  } catch (error) {
    console.error('❌ Cannot connect to OLD database:', error)
    process.exit(1)
  }

  try {
    await newPrisma.$connect()
    console.log('✅ Connected to NEW database\n')
  } catch (error) {
    console.error('❌ Cannot connect to NEW database:', error)
    process.exit(1)
  }

  // Migrate each table
  for (const model of modelsToMigrate) {
    await migrateTable(model)
  }

  console.log('\n✨ Migration complete!\n')

  // Get record counts from both databases
  console.log('📊 Final record counts:')

  for (const model of modelsToMigrate) {
    try {
      // @ts-ignore
      const oldCount = await oldPrisma[model].count()
      // @ts-ignore
      const newCount = await newPrisma[model].count()

      if (oldCount > 0 || newCount > 0) {
        console.log(`   ${model}: ${oldCount} → ${newCount}`)
      }
    } catch (error) {
      // Skip if table doesn't exist
    }
  }

  await oldPrisma.$disconnect()
  await newPrisma.$disconnect()
}

main()
  .catch((error) => {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })
