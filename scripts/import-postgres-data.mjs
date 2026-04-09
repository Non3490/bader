import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const inputPath = path.join(process.cwd(), 'prisma', 'production-export.json')
const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const tables = payload.tables || {}

const importPlan = [
  ['tenantSettings', 'TenantSettings'],
  ['zone', 'Zone'],
  ['user', 'User'],
  ['customer', 'Customer'],
  ['blacklist', 'Blacklist'],
  ['product', 'Product'],
  ['stock', 'Stock'],
  ['stockMovement', 'StockMovement'],
  ['stockSnapshot', 'StockSnapshot'],
  ['expenseType', 'ExpenseType'],
  ['order', 'Order'],
  ['orderItem', 'OrderItem'],
  ['orderHistory', 'OrderHistory'],
  ['callLog', 'CallLog'],
  ['expense', 'Expense'],
  ['integration', 'Integration'],
  ['googleSheet', 'GoogleSheet'],
  ['deliveryLocation', 'DeliveryLocation'],
  ['deliveryFeeConfig', 'DeliveryFeeConfig'],
  ['systemSetting', 'SystemSetting'],
  ['activityLog', 'ActivityLog'],
  ['wallet', 'Wallet'],
  ['walletTransaction', 'WalletTransaction'],
  ['withdrawalRequest', 'WithdrawalRequest'],
  ['catalogProduct', 'CatalogProduct'],
  ['catalogFavorite', 'CatalogFavorite'],
  ['sourcingRequest', 'SourcingRequest'],
  ['apiKey', 'ApiKey'],
  ['callRecording', 'CallRecording'],
  ['twilioSettings', 'TwilioSettings'],
  ['carrierSettings', 'CarrierSettings'],
  ['notificationLog', 'NotificationLog'],
  ['notification', 'Notification'],
  ['agentSession', 'AgentSession'],
  ['invoice', 'Invoice'],
]

const booleanKeys = new Set([
  'isActive',
  'isOnline',
  'isRead',
  'autoFlagged',
  'authorizeOpen',
  'smsEnabled',
  'isLocked',
])

function isDateKey(key) {
  return key.endsWith('At') || key.endsWith('Date') || key === 'lastSeen' || key === 'dateFrom' || key === 'dateTo'
}

function normalizeValue(key, value) {
  if (value === null || value === undefined) return value

  if (booleanKeys.has(key)) {
    return typeof value === 'boolean' ? value : Boolean(value)
  }

  if (isDateKey(key)) {
    if (typeof value === 'number') return new Date(value)
    if (typeof value === 'string' && value.trim()) return new Date(value)
  }

  return value
}

async function main() {
  for (const [delegateName, tableName] of importPlan) {
    const rows = Array.isArray(tables[tableName]) ? tables[tableName] : []
    if (!rows.length) {
      console.log(`Skipping ${tableName} (0 rows)`)
      continue
    }

    const delegate = prisma[delegateName]
    if (!delegate?.createMany) {
      throw new Error(`Missing Prisma delegate for ${tableName} (${delegateName})`)
    }

    const data = rows.map((row) => {
      const normalized = {}
      for (const [key, value] of Object.entries(row)) {
        // Handle schema migration: warehouse -> warehouseId
        if (key === 'warehouse') {
          // Skip warehouse field as it's been migrated to warehouseId
          continue
        }
        normalized[key] = normalizeValue(key, value)
      }
      return normalized
    })

    const result = await delegate.createMany({
      data,
      skipDuplicates: true,
    })
    console.log(`Imported ${tableName}: ${result.count}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
