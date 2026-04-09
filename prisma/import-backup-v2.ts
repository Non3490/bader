/**
 * Import Script v2: Handle schema changes from old backup
 *
 * This script handles schema differences between old and new database versions
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

// Convert timestamp numbers to Date objects
function toDate(value: any): Date | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    return new Date(value)
  }
  return value
}

// Convert 0/1 to boolean
function toBool(value: any): boolean {
  return Boolean(value)
}

async function main() {
  console.log('🚀 Starting import from backup...\n')

  // Read backup
  const backupPath = join(process.cwd(), 'prisma', 'production-export.json')
  const backup = JSON.parse(readFileSync(backupPath, 'utf-8'))
  const tables = backup.tables

  // Step 1: Import Users (already done, but skip if exists)
  console.log('📥 Step 1: Users')
  if (tables.User?.length > 0) {
    try {
      const existingCount = await prisma.user.count()
      if (existingCount === 0) {
        for (const u of tables.User) {
          await prisma.user.create({
            data: {
              id: u.id,
              email: u.email,
              password: u.password,
              name: u.name,
              phone: u.phone,
              role: u.role,
              isActive: toBool(u.isActive),
              parentSellerId: u.parentSellerId,
              zoneId: u.zoneId,
              createdAt: toDate(u.createdAt),
              tenantSettingsId: u.tenantSettingsId,
            },
            skipDuplicates: true,
          })
        }
        console.log(`   ✅ Imported ${tables.User.length} users`)
      } else {
        console.log(`   ⏭️  Users already exist (${existingCount})`)
      }
    } catch (e: any) {
      console.log(`   ⚠️  ${e.message}`)
    }
  }

  // Step 2: Import Products
  console.log('\n📥 Step 2: Products')
  if (tables.Product?.length > 0) {
    try {
      const existingCount = await prisma.product.count()
      if (existingCount === 0) {
        for (const p of tables.Product) {
          await prisma.product.upsert({
            where: { id: p.id },
            update: {},
            create: {
              id: p.id,
              sellerId: p.sellerId,
              sku: p.sku,
              name: p.name,
              costPrice: p.costPrice,
              sellPrice: p.sellPrice,
              isActive: toBool(p.isActive),
              authorizeOpen: toBool(p.authorizeOpen),
              currentStock: 0,
              reorderPoint: 10,
              trackInventory: true,
              createdAt: toDate(p.createdAt),
              updatedAt: toDate(p.createdAt),
            },
          })
        }
        console.log(`   ✅ Imported ${tables.Product.length} products`)
      } else {
        console.log(`   ⏭️  Products already exist (${existingCount})`)
      }
    } catch (e: any) {
      console.log(`   ⚠️  ${e.message}`)
    }
  }

  // Step 3: Create a default warehouse for Stock records
  console.log('\n📥 Step 3: Default Warehouse')
  let defaultWarehouse: any = null
  try {
    defaultWarehouse = await prisma.warehouse.findFirst({
      where: { name: 'Libreville Main' },
    })
    if (!defaultWarehouse) {
      defaultWarehouse = await prisma.warehouse.create({
        data: {
          name: 'Libreville Main',
          city: 'Libreville',
          isActive: true,
        },
      })
      console.log('   ✅ Created default warehouse')
    } else {
      console.log('   ⏭️  Default warehouse exists')
    }
  } catch (e: any) {
    console.log(`   ⚠️  ${e.message}`)
  }

  // Step 4: Import Stock (with warehouse mapping)
  console.log('\n📥 Step 4: Stock')
  if (tables.Stock?.length > 0 && defaultWarehouse) {
    try {
      for (const s of tables.Stock) {
        await prisma.stock.upsert({
          where: { id: s.id },
          update: {},
          create: {
            id: s.id,
            productId: s.productId,
            sellerId: s.sellerId,
            warehouseId: defaultWarehouse.id,
            quantity: s.quantity,
            alertLevel: s.alertLevel,
            updatedAt: toDate(s.updatedAt),
          },
        })
      }
      console.log(`   ✅ Imported ${tables.Stock.length} stock records`)
    } catch (e: any) {
      console.log(`   ⚠️  ${e.message}`)
    }
  }

  // Step 5: Import Orders
  console.log('\n📥 Step 5: Orders')
  if (tables.Order?.length > 0) {
    let imported = 0
    let errors = 0

    for (const o of tables.Order) {
      try {
        await prisma.order.upsert({
          where: { id: o.id },
          update: {},
          create: {
            id: o.id,
            trackingNumber: o.trackingNumber,
            sellerId: o.sellerId,
            deliveryManId: o.deliveryManId,
            zoneId: o.zoneId,
            assignedAgentId: o.assignedAgentId,
            lockedByAgentId: o.lockedByAgentId,
            lockedAt: toDate(o.lockedAt),
            callAttempts: o.callAttempts || 0,
            priority: o.priority || 0,
            recipientName: o.recipientName,
            phone: o.phone,
            address: o.address,
            city: o.city,
            note: o.note,
            codAmount: o.codAmount,
            status: o.status,
            source: o.source,
            groupId: o.groupId,
            bundleGroupId: o.bundleGroupId,
            scheduledCallAt: toDate(o.scheduledCallAt),
            podPhotoUrl: o.podPhotoUrl,
            podSignatureUrl: o.podSignatureUrl,
            carrierId: o.carrierId,
            carrierName: o.carrierName,
            awbTrackingCode: o.awbTrackingCode,
            awbLabelUrl: o.awbLabelUrl,
            dispatchedAt: toDate(o.dispatchedAt),
            productCost: o.productCost || 0,
            shippingCost: o.shippingCost || 0,
            callCenterFee: o.callCenterFee || 0,
            platformFee: o.platformFee || 5000,
            bundleDeliveryShare: o.bundleDeliveryShare,
            adSpend: o.adSpend || 0,
            confirmedAt: toDate(o.confirmedAt),
            shippedAt: toDate(o.shippedAt),
            deliveredAt: toDate(o.deliveredAt),
            returnedAt: toDate(o.returnedAt),
            cancelledAt: toDate(o.cancelledAt),
            createdAt: toDate(o.createdAt),
            updatedAt: toDate(o.updatedAt),
          },
        })
        imported++
      } catch (e: any) {
        errors++
        if (errors <= 3) {
          console.log(`      ⚠️  ${e.message.substring(0, 80)}...`)
        }
      }
    }
    console.log(`   ✅ Orders: ${imported} imported, ${errors} errors`)
  }

  // Step 6: Import OrderItems
  console.log('\n📥 Step 6: Order Items')
  if (tables.OrderItem?.length > 0) {
    try {
      let imported = 0
      for (const oi of tables.OrderItem) {
        await prisma.orderItem.upsert({
          where: { id: oi.id },
          update: {},
          create: {
            id: oi.id,
            orderId: oi.orderId,
            productId: oi.productId,
            quantity: oi.quantity,
            unitPrice: oi.unitPrice,
          },
        })
        imported++
      }
      console.log(`   ✅ Imported ${imported} order items`)
    } catch (e: any) {
      console.log(`   ⚠️  ${e.message}`)
    }
  }

  // Step 7: Import OrderHistory
  console.log('\n📥 Step 7: Order History')
  if (tables.OrderHistory?.length > 0) {
    try {
      let imported = 0
      for (const oh of tables.OrderHistory) {
        await prisma.orderHistory.upsert({
          where: { id: oh.id },
          update: {},
          create: {
            id: oh.id,
            orderId: oh.orderId,
            previousStatus: oh.previousStatus,
            newStatus: oh.newStatus,
            changedById: oh.changedById,
            note: oh.note,
            createdAt: toDate(oh.createdAt),
          },
        })
        imported++
      }
      console.log(`   ✅ Imported ${imported} order history records`)
    } catch (e: any) {
      console.log(`   ⚠️  ${e.message}`)
    }
  }

  // Step 8: Import StockMovements (mapped to stockId)
  console.log('\n📥 Step 8: Stock Movements')
  if (tables.StockMovement?.length > 0) {
    try {
      let imported = 0
      for (const sm of tables.StockMovement) {
        await prisma.stockMovement.upsert({
          where: { id: sm.id },
          update: {},
          create: {
            id: sm.id,
            stockId: sm.stockId,
            type: sm.type,
            quantity: sm.quantity,
            reason: sm.reason,
            createdAt: toDate(sm.createdAt),
          },
        })
        imported++
      }
      console.log(`   ✅ Imported ${imported} stock movements`)
    } catch (e: any) {
      console.log(`   ⚠️  ${e.message}`)
    }
  }

  // Step 9: Import Wallets
  console.log('\n📥 Step 9: Wallets')
  if (tables.Wallet?.length > 0) {
    try {
      for (const w of tables.Wallet) {
        await prisma.wallet.upsert({
          where: { id: w.id },
          update: {},
          create: {
            id: w.id,
            sellerId: w.sellerId,
            balance: w.balance,
            totalEarned: w.totalEarned,
            totalDeducted: w.totalDeducted,
            updatedAt: toDate(w.updatedAt),
          },
        })
      }
      console.log(`   ✅ Imported ${tables.Wallet.length} wallets`)
    } catch (e: any) {
      console.log(`   ⚠️  ${e.message}`)
    }
  }

  // Step 10: Import ActivityLogs
  console.log('\n📥 Step 10: Activity Logs')
  if (tables.ActivityLog?.length > 0) {
    try {
      let imported = 0
      for (const al of tables.ActivityLog) {
        await prisma.activityLog.upsert({
          where: { id: al.id },
          update: {},
          create: {
            id: al.id,
            userId: al.userId,
            role: al.role,
            action: al.action,
            details: al.details,
            ipAddress: al.ipAddress,
            createdAt: toDate(al.createdAt),
          },
        })
        imported++
      }
      console.log(`   ✅ Imported ${imported} activity logs`)
    } catch (e: any) {
      console.log(`   ⚠️  ${e.message}`)
    }
  }

  console.log('\n✨ Import complete!\n')

  // Summary
  console.log('📊 Database Summary:')
  const userCount = await prisma.user.count()
  const productCount = await prisma.product.count()
  const orderCount = await prisma.order.count()
  const stockCount = await prisma.stock.count()

  console.log(`   Users: ${userCount}`)
  console.log(`   Products: ${productCount}`)
  console.log(`   Orders: ${orderCount}`)
  console.log(`   Stock: ${stockCount}`)

  await prisma.$disconnect()
}

main().catch(console.error)
