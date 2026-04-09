/**
 * Gabon COD Platform — Production Data Import
 * Imports data from production-export.json into the database
 *
 * Run: npx tsx prisma/seed-production.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const db = new PrismaClient()

// Helper function to convert integer (0/1) to boolean
function intToBool(value: number | boolean): boolean {
  if (typeof value === 'boolean') return value
  return value === 1
}

interface ExportData {
  exportedAt: string
  tables: {
    User: Array<{
      id: string
      email: string
      password: string
      name: string
      phone: string
      role: string
      isActive: number
      parentSellerId: string | null
      zoneId: string | null
      createdAt: number
      tenantSettingsId: string | null
    }>
    Customer: Array<{
      id: string
      phone: string
      deliveryRate: number
      orderCount: number
      deliveredCount: number
      updatedAt: string
    }>
    Blacklist: Array<{
      id: string
      phone: string
      reason: string | null
      autoFlagged: boolean
      returnCount: number
      createdAt: string
      removedAt: string | null
      removedBy: string | null
      isActive: boolean
    }>
    Zone: Array<{
      id: string
      name: string
      city: string
      description: string | null
    }>
    Product: Array<{
      id: string
      sellerId: string
      sku: string
      name: string
      shortDescription: string | null
      longDescription: string | null
      imageUrl: string | null
      supplierName: string | null
      supplierPhone: string | null
      cargoName: string | null
      cargoPhone: string | null
      quantityPricing: string | null
      category: string | null
      costPrice: number
      sellPrice: number
      isActive: number
      authorizeOpen: number
      createdAt: number
      updatedAt: number | null
    }>
    Stock: Array<{
      id: string
      productId: string
      sellerId: string
      warehouseId: string | null
      quantity: number
      alertLevel: number
      updatedAt: string
    }>
    StockMovement: Array<{
      id: string
      stockId: string
      warehouseId: string | null
      type: string
      quantity: number
      reason: string | null
      userId: string | null
      adminId: string | null
      createdAt: string
    }>
    Order: Array<{
      id: string
      trackingNumber: string
      sellerId: string
      deliveryManId: string | null
      zoneId: string | null
      deliveryZoneId: string | null
      assignedAgentId: string | null
      lockedByAgentId: string | null
      lockedAt: string | null
      callAttempts: number
      priority: number
      recipientName: string
      phone: string
      address: string
      city: string
      note: string | null
      codAmount: number
      status: string
      source: string
      groupId: string | null
      bundleGroupId: string | null
      scheduledCallAt: string | null
      podPhotoUrl: string | null
      podSignatureUrl: string | null
      carrierId: string | null
      carrierName: string | null
      awbTrackingCode: string | null
      awbLabelUrl: string | null
      dispatchedAt: string | null
      productCost: number
      shippingCost: number
      callCenterFee: number
      platformFee: number
      bundleDeliveryShare: number | null
      adSpend: number
      confirmedAt: string | null
      shippedAt: string | null
      deliveredAt: string | null
      returnedAt: string | null
      cancelledAt: string | null
      lastModifiedById: string | null
      createdAt: number
      updatedAt: string | null
    }>
    OrderItem: Array<{
      id: string
      orderId: string
      productId: string
      quantity: number
      unitPrice: number
    }>
    OrderHistory: Array<{
      id: string
      orderId: string
      previousStatus: string | null
      newStatus: string
      changedById: string
      note: string | null
      createdAt: string
    }>
    CallLog: Array<{
      id: string
      orderId: string
      agentId: string
      attempt: string
      comment: string | null
      createdAt: string
    }>
    ActivityLog: Array<{
      id: string
      userId: string
      role: string
      action: string
      details: string
      ipAddress: string | null
      createdAt: string
    }>
    Wallet: Array<{
      id: string
      sellerId: string
      balance: number
      totalEarned: number
      totalDeducted: number
      updatedAt: string
    }>
    WalletTransaction: Array<{
      id: string
      walletId: string
      type: string
      amount: number
      description: string
      orderId: string | null
      createdAt: string
    }>
    Warehouse: Array<{
      id: string
      name: string
      city: string
      address: string | null
      isActive: boolean
      createdAt: string
    }>
    DeliveryZone: Array<{
      id: string
      name: string
      polygon: unknown
      driverId: string | null
      createdAt: string
      updatedAt: string | null
    }>
    DeliveryLocation: Array<{
      id: string
      driverId: string
      lat: number
      lng: number
      address: string | null
      accuracy: number | null
      createdAt: string
    }>
    DeliveryFeeConfig: Array<{
      id: string
      deliveryManId: string
      costPerDelivery: number
      bonusAmount: number
      penaltyAmount: number
      createdAt: string
      updatedAt: string | null
    }>
    AgentSession: Array<{
      id: string
      userId: string
      lastSeen: string
      isOnline: boolean
      currentWorkload: number
      createdAt: string
    }>
    Notification: Array<{
      id: string
      userId: string
      title: string
      message: string
      type: string
      link: string | null
      isRead: boolean
      createdAt: string
    }>
    SystemSetting: Array<{
      id: string
      key: string
      value: string
      description: string | null
      updatedAt: string | null
    }>
    ExpenseType: Array<{
      id: string
      name: string
      category: string
      description: string | null
      isActive: boolean
      createdAt: string
    }>
    Expense: Array<{
      id: string
      sellerId: string | null
      agentId: string | null
      orderId: string | null
      category: string
      expenseTypeId: string | null
      amount: number
      description: string | null
      incurredAt: string
    }>
    Integration: Array<{
      id: string
      sellerId: string
      platform: string
      secret: string
      isActive: boolean
      lastHit: string | null
      createdAt: string
      updatedAt: string | null
    }>
    GoogleSheet: Array<{
      id: string
      sellerId: string
      spreadsheetId: string
      sheetName: string
      lastSyncedAt: string | null
      lastSyncStatus: string | null
      lastSyncError: string | null
      createdAt: string
    }>
    ApiKey: Array<{
      id: string
      sellerId: string
      key: string
      lastUsedAt: string | null
      createdAt: string
    }>
    CatalogProduct: Array<{
      id: string
      name: string
      description: string | null
      imageUrl: string | null
      costPrice: number
      category: string | null
      countryAvailable: string | null
      isActive: boolean
      createdAt: string
    }>
    CatalogFavorite: Array<{
      id: string
      sellerId: string
      catalogProductId: string
      createdAt: string
    }>
    SourcingRequest: Array<{
      id: string
      sellerId: string
      productName: string
      description: string | null
      referenceUrl: string | null
      images: string | null
      quantity: number
      country: string
      shippingMethod: string
      trackingDetails: string | null
      type: string
      status: string
      adminNote: string | null
      receivedQty: number | null
      receivedImages: string | null
      damagedQty: number | null
      createdAt: string
      updatedAt: string | null
      reviewedAt: string | null
      reviewedBy: string | null
      inTransitAt: string | null
      receivedAt: string | null
      stockedAt: string | null
    }>
    CallRecording: Array<{
      id: string
      orderId: string
      agentId: string
      twilioCallSid: string
      recordingUrl: string
      recordingSid: string
      durationSeconds: number
      status: string
      createdAt: string
    }>
    NotificationLog: Array<{
      id: string
      orderId: string
      type: string
      channel: string
      phone: string
      message: string
      status: string
      sentAt: string
    }>
    Invoice: Array<{
      id: string
      sellerId: string
      deliveryManId: string | null
      ref: string
      cashCollected: number
      refundedAmount: number
      subtotal: number
      vat: number
      totalNet: number
      status: string
      cycleType: string
      dateFrom: string
      dateTo: string
      isLocked: boolean
      lockedAt: string | null
      createdAt: string
    }>
    InvoiceLineItem: Array<{
      id: string
      invoiceId: string
      description: string
      quantity: number
      unitPrice: number
      amount: number
      category: string | null
      orderId: string | null
      createdAt: string
    }>
    RemittanceLock: Array<{
      id: string
      deliveryManId: string
      periodStart: string
      periodEnd: string
      cashCollected: number
      deliveryCount: number
      totalFees: number
      netDue: number
      invoiceId: string | null
      status: string
      lockedAt: string
      unlockedAt: string | null
      createdAt: string
    }>
    WebhookActivity: Array<{
      id: string
      platform: string
      status: string
      eventType: string
      orderId: string | null
      trackingNumber: string | null
      reason: string | null
      payload: string | null
      ipAddress: string | null
      headers: string | null
      integrationId: string | null
      createdAt: string
    }>
    StockSnapshot: Array<{
      id: string
      productId: string
      date: string
      initialStock: number
      inForDelivery: number
      outForDelivery: number
      finalStock: number
      snapshotDate: string
    }>
    WithdrawalRequest: Array<{
      id: string
      walletId: string
      amount: number
      method: string
      account: string | null
      status: string
      requestedAt: string
      processedAt: string | null
      processedBy: string | null
      note: string | null
    }>
    TenantSettings: Array<{
      id: string
      twilioSid: string | null
      twilioToken: string | null
      twilioPhone: string | null
      smsEnabled: boolean
      pusherAppId: string | null
      pusherKey: string | null
      pusherCluster: string | null
      pusherChannel: string | null
      createdAt: string
      updatedAt: string | null
    }>
    TwilioSettings: Array<{
      id: string
      accountSid: string
      authToken: string
      apiKey: string
      apiSecret: string
      twimlAppSid: string
      phoneNumber: string
      updatedAt: string | null
    }>
    CarrierSettings: Array<{
      id: string
      name: string
      apiKey: string
      apiSecret: string | null
      isActive: boolean
      webhookUrl: string | null
      updatedAt: string | null
    }>
    Admin: Array<{
      id: string
      email: string
      password: string
      name: string
      role: string
      status: string
      lastLoginAt: string | null
      forcePasswordChange: boolean
      createdBy: string | null
      createdAt: string
      updatedAt: string | null
    }>
    AuditLog: Array<{
      id: string
      adminId: string
      userName: string
      userRole: string
      action: string
      targetType: string
      targetId: string
      details: string
      ipAddress: string | null
      impersonatingId: string | null
      impersonatorId: string | null
      createdAt: string
    }>
  }
}

async function main() {
  console.log('🌍 Importing production data to Gabon COD Platform...')

  // Read the export file
  const exportPath = path.join(__dirname, 'production-export.json')
  const exportContent = fs.readFileSync(exportPath, 'utf-8')
  const data: ExportData = JSON.parse(exportContent)

  console.log(`📦 Export from: ${data.exportedAt}`)
  console.log('⚠️  This will DELETE all existing data and import from export!')
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...')

  await new Promise(resolve => setTimeout(resolve, 5000))

  // Clean existing data in correct order (respect foreign keys)
  console.log('🗑️  Cleaning existing data...')

  await db.auditLog.deleteMany({})
  await db.webhookActivity.deleteMany({})
  await db.withdrawalRequest.deleteMany({})
  await db.walletTransaction.deleteMany({})
  await db.wallet.deleteMany({})
  await db.stockSnapshot.deleteMany({})
  await db.stockMovement.deleteMany({})
  await db.stock.deleteMany({})
  await db.sourcingRequest.deleteMany({})
  await db.remittanceLock.deleteMany({})
  await db.orderHistory.deleteMany({})
  await db.callLog.deleteMany({})
  await db.phoneCallLog.deleteMany({})
  await db.notificationLog.deleteMany({})
  await db.callRecording.deleteMany({})
  await db.orderItem.deleteMany({})
  await db.order.deleteMany({})
  await db.product.deleteMany({})
  await db.catalogFavorite.deleteMany({})
  await db.catalogProduct.deleteMany({})
  await db.blacklist.deleteMany({})
  await db.customer.deleteMany({})
  await db.activityLog.deleteMany({})
  await db.agentSession.deleteMany({})
  await db.googleSheet.deleteMany({})
  await db.integration.deleteMany({})
  await db.invoiceLineItem.deleteMany({})
  await db.invoice.deleteMany({})
  await db.expense.deleteMany({})
  await db.expenseType.deleteMany({})
  await db.deliveryLocation.deleteMany({})
  await db.deliveryFeeConfig.deleteMany({})
  await db.deliveryZone.deleteMany({})
  await db.notification.deleteMany({})
  await db.systemSetting.deleteMany({})
  await db.apiKey.deleteMany({})
  await db.warehouse.deleteMany({})
  await db.zone.deleteMany({})
  await db.admin.deleteMany({})
  await db.tenantSettings.deleteMany({})
  await db.carrierSettings.deleteMany({})
  await db.twilioSettings.deleteMany({})
  await db.user.deleteMany({})

  console.log('✅ Database cleaned')

  // Import TenantSettings
  if (data.tables.TenantSettings?.length > 0) {
    console.log(`📋 Importing ${data.tables.TenantSettings.length} TenantSettings...`)
    for (const item of data.tables.TenantSettings) {
      await db.tenantSettings.create({
        data: {
          id: item.id,
          twilioSid: item.twilioSid,
          twilioToken: item.twilioToken,
          twilioPhone: item.twilioPhone,
          smsEnabled: item.smsEnabled,
          pusherAppId: item.pusherAppId,
          pusherKey: item.pusherKey,
          pusherCluster: item.pusherCluster,
          pusherChannel: item.pusherChannel,
          createdAt: new Date(item.createdAt),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
        }
      })
    }
    console.log('✅ TenantSettings imported')
  }

  // Import Zones
  if (data.tables.Zone?.length > 0) {
    console.log(`📍 Importing ${data.tables.Zone.length} Zones...`)
    for (const item of data.tables.Zone) {
      await db.zone.create({
        data: {
          id: item.id,
          name: item.name,
          city: item.city,
          description: item.description
        }
      })
    }
    console.log('✅ Zones imported')
  }

  // Import Warehouses
  if (data.tables.Warehouse?.length > 0) {
    console.log(`🏭 Importing ${data.tables.Warehouse.length} Warehouses...`)
    for (const item of data.tables.Warehouse) {
      await db.warehouse.create({
        data: {
          id: item.id,
          name: item.name,
          city: item.city,
          address: item.address,
          isActive: item.isActive,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ Warehouses imported')
  }

  // Import Users (Admin, Sellers, Agents, Delivery)
  console.log(`👥 Importing ${data.tables.User.length} Users...`)
  for (const item of data.tables.User) {
    await db.user.create({
      data: {
        id: item.id,
        email: item.email,
        password: item.password,
        name: item.name,
        phone: item.phone,
        role: item.role,
        isActive: item.isActive === 1,
        parentSellerId: item.parentSellerId,
        zoneId: item.zoneId,
        tenantSettingsId: item.tenantSettingsId,
        createdAt: new Date(item.createdAt)
      }
    })
  }
  console.log('✅ Users imported')

  // Import Customers
  if (data.tables.Customer?.length > 0) {
    console.log(`👤 Importing ${data.tables.Customer.length} Customers...`)
    for (const item of data.tables.Customer) {
      await db.customer.create({
        data: {
          id: item.id,
          phone: item.phone,
          deliveryRate: item.deliveryRate,
          orderCount: item.orderCount,
          deliveredCount: item.deliveredCount,
          updatedAt: new Date(item.updatedAt)
        }
      })
    }
    console.log('✅ Customers imported')
  }

  // Import Blacklist
  if (data.tables.Blacklist?.length > 0) {
    console.log(`🚫 Importing ${data.tables.Blacklist.length} Blacklist entries...`)
    for (const item of data.tables.Blacklist) {
      await db.blacklist.create({
        data: {
          id: item.id,
          phone: item.phone,
          reason: item.reason,
          autoFlagged: item.autoFlagged,
          returnCount: item.returnCount,
          createdAt: new Date(item.createdAt),
          removedAt: item.removedAt ? new Date(item.removedAt) : null,
          removedBy: item.removedBy,
          isActive: item.isActive
        }
      })
    }
    console.log('✅ Blacklist imported')
  }

  // Import Products
  console.log(`📦 Importing ${data.tables.Product.length} Products...`)
  for (const item of data.tables.Product) {
    await db.product.create({
      data: {
        id: item.id,
        sellerId: item.sellerId,
        sku: item.sku,
        name: item.name,
        shortDescription: item.shortDescription,
        longDescription: item.longDescription,
        imageUrl: item.imageUrl,
        supplierName: item.supplierName,
        supplierPhone: item.supplierPhone,
        cargoName: item.cargoName,
        cargoPhone: item.cargoPhone,
        quantityPricing: item.quantityPricing ? JSON.parse(item.quantityPricing as string) : null,
        category: item.category,
        costPrice: item.costPrice,
        sellPrice: item.sellPrice,
        isActive: item.isActive === 1,
        authorizeOpen: item.authorizeOpen === 1,
        createdAt: new Date(item.createdAt),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
      }
    })
  }
  console.log('✅ Products imported')

  // Import Stocks
  if (data.tables.Stock?.length > 0) {
    console.log(`📊 Importing ${data.tables.Stock.length} Stocks...`)
    for (const item of data.tables.Stock) {
      await db.stock.create({
        data: {
          id: item.id,
          productId: item.productId,
          sellerId: item.sellerId,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
          alertLevel: item.alertLevel,
          updatedAt: new Date(item.updatedAt)
        }
      })
    }
    console.log('✅ Stocks imported')
  }

  // Import StockMovements
  if (data.tables.StockMovement?.length > 0) {
    console.log(`📈 Importing ${data.tables.StockMovement.length} StockMovements...`)
    for (const item of data.tables.StockMovement) {
      await db.stockMovement.create({
        data: {
          id: item.id,
          stockId: item.stockId,
          warehouseId: item.warehouseId,
          type: item.type,
          quantity: item.quantity,
          reason: item.reason,
          userId: item.userId,
          adminId: item.adminId,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ StockMovements imported')
  }

  // Import Wallets
  if (data.tables.Wallet?.length > 0) {
    console.log(`💰 Importing ${data.tables.Wallet.length} Wallets...`)
    for (const item of data.tables.Wallet) {
      await db.wallet.create({
        data: {
          id: item.id,
          sellerId: item.sellerId,
          balance: item.balance,
          totalEarned: item.totalEarned,
          totalDeducted: item.totalDeducted,
          updatedAt: new Date(item.updatedAt)
        }
      })
    }
    console.log('✅ Wallets imported')
  }

  // Import WalletTransactions
  if (data.tables.WalletTransaction?.length > 0) {
    console.log(`💳 Importing ${data.tables.WalletTransaction.length} WalletTransactions...`)
    for (const item of data.tables.WalletTransaction) {
      await db.walletTransaction.create({
        data: {
          id: item.id,
          walletId: item.walletId,
          type: item.type,
          amount: item.amount,
          description: item.description,
          orderId: item.orderId,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ WalletTransactions imported')
  }

  // Import DeliveryZones
  if (data.tables.DeliveryZone?.length > 0) {
    console.log(`🗺️  Importing ${data.tables.DeliveryZone.length} DeliveryZones...`)
    for (const item of data.tables.DeliveryZone) {
      await db.deliveryZone.create({
        data: {
          id: item.id,
          name: item.name,
          polygon: item.polygon,
          driverId: item.driverId,
          createdAt: new Date(item.createdAt),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
        }
      })
    }
    console.log('✅ DeliveryZones imported')
  }

  // Import DeliveryFeeConfigs
  if (data.tables.DeliveryFeeConfig?.length > 0) {
    console.log(`💵 Importing ${data.tables.DeliveryFeeConfig.length} DeliveryFeeConfigs...`)
    for (const item of data.tables.DeliveryFeeConfig) {
      await db.deliveryFeeConfig.create({
        data: {
          id: item.id,
          deliveryManId: item.deliveryManId,
          costPerDelivery: item.costPerDelivery,
          bonusAmount: item.bonusAmount,
          penaltyAmount: item.penaltyAmount,
          createdAt: new Date(item.createdAt),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
        }
      })
    }
    console.log('✅ DeliveryFeeConfigs imported')
  }

  // Import AgentSessions
  if (data.tables.AgentSession?.length > 0) {
    console.log(`🔄 Importing ${data.tables.AgentSession.length} AgentSessions...`)
    for (const item of data.tables.AgentSession) {
      await db.agentSession.create({
        data: {
          id: item.id,
          userId: item.userId,
          lastSeen: new Date(item.lastSeen),
          isOnline: intToBool(item.isOnline),
          currentWorkload: item.currentWorkload,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ AgentSessions imported')
  }

  // Import Orders
  console.log(`📦 Importing ${data.tables.Order.length} Orders...`)
  for (const item of data.tables.Order) {
    await db.order.create({
      data: {
        id: item.id,
        trackingNumber: item.trackingNumber,
        sellerId: item.sellerId,
        deliveryManId: item.deliveryManId,
        zoneId: item.zoneId,
        deliveryZoneId: item.deliveryZoneId,
        assignedAgentId: item.assignedAgentId,
        lockedByAgentId: item.lockedByAgentId,
        lockedAt: item.lockedAt ? new Date(item.lockedAt) : null,
        callAttempts: item.callAttempts,
        priority: item.priority,
        recipientName: item.recipientName,
        phone: item.phone,
        address: item.address,
        city: item.city,
        note: item.note,
        codAmount: item.codAmount,
        status: item.status,
        source: item.source,
        groupId: item.groupId,
        bundleGroupId: item.bundleGroupId,
        scheduledCallAt: item.scheduledCallAt ? new Date(item.scheduledCallAt) : null,
        podPhotoUrl: item.podPhotoUrl,
        podSignatureUrl: item.podSignatureUrl,
        carrierId: item.carrierId,
        carrierName: item.carrierName,
        awbTrackingCode: item.awbTrackingCode,
        awbLabelUrl: item.awbLabelUrl,
        dispatchedAt: item.dispatchedAt ? new Date(item.dispatchedAt) : null,
        productCost: item.productCost,
        shippingCost: item.shippingCost,
        callCenterFee: item.callCenterFee,
        platformFee: item.platformFee,
        bundleDeliveryShare: item.bundleDeliveryShare,
        adSpend: item.adSpend,
        confirmedAt: item.confirmedAt ? new Date(item.confirmedAt) : null,
        shippedAt: item.shippedAt ? new Date(item.shippedAt) : null,
        deliveredAt: item.deliveredAt ? new Date(item.deliveredAt) : null,
        returnedAt: item.returnedAt ? new Date(item.returnedAt) : null,
        cancelledAt: item.cancelledAt ? new Date(item.cancelledAt) : null,
        lastModifiedById: item.lastModifiedById,
        createdAt: new Date(item.createdAt),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
      }
    })
  }
  console.log('✅ Orders imported')

  // Import OrderItems
  if (data.tables.OrderItem?.length > 0) {
    console.log(`📦 Importing ${data.tables.OrderItem.length} OrderItems...`)
    for (const item of data.tables.OrderItem) {
      await db.orderItem.create({
        data: {
          id: item.id,
          orderId: item.orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }
      })
    }
    console.log('✅ OrderItems imported')
  }

  // Import OrderHistory
  if (data.tables.OrderHistory?.length > 0) {
    console.log(`📜 Importing ${data.tables.OrderHistory.length} OrderHistory entries...`)
    for (const item of data.tables.OrderHistory) {
      await db.orderHistory.create({
        data: {
          id: item.id,
          orderId: item.orderId,
          previousStatus: item.previousStatus,
          newStatus: item.newStatus,
          changedById: item.changedById,
          note: item.note,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ OrderHistory imported')
  }

  // Import CallLogs
  if (data.tables.CallLog?.length > 0) {
    console.log(`📞 Importing ${data.tables.CallLog.length} CallLogs...`)
    for (const item of data.tables.CallLog) {
      await db.callLog.create({
        data: {
          id: item.id,
          orderId: item.orderId,
          agentId: item.agentId,
          attempt: item.attempt,
          comment: item.comment,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ CallLogs imported')
  }

  // Import ActivityLogs
  if (data.tables.ActivityLog?.length > 0) {
    console.log(`📝 Importing ${data.tables.ActivityLog.length} ActivityLogs...`)
    for (const item of data.tables.ActivityLog) {
      await db.activityLog.create({
        data: {
          id: item.id,
          userId: item.userId,
          role: item.role,
          action: item.action,
          details: item.details,
          ipAddress: item.ipAddress,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ ActivityLogs imported')
  }

  // Import Notifications
  if (data.tables.Notification?.length > 0) {
    console.log(`🔔 Importing ${data.tables.Notification.length} Notifications...`)
    for (const item of data.tables.Notification) {
      await db.notification.create({
        data: {
          id: item.id,
          userId: item.userId,
          title: item.title,
          message: item.message,
          type: item.type,
          link: item.link,
          isRead: item.isRead,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ Notifications imported')
  }

  // Import SystemSettings
  if (data.tables.SystemSetting?.length > 0) {
    console.log(`⚙️  Importing ${data.tables.SystemSetting.length} SystemSettings...`)
    for (const item of data.tables.SystemSetting) {
      await db.systemSetting.create({
        data: {
          id: item.id,
          key: item.key,
          value: item.value,
          description: item.description,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
        }
      })
    }
    console.log('✅ SystemSettings imported')
  }

  // Import ExpenseTypes
  if (data.tables.ExpenseType?.length > 0) {
    console.log(`💸 Importing ${data.tables.ExpenseType.length} ExpenseTypes...`)
    for (const item of data.tables.ExpenseType) {
      await db.expenseType.create({
        data: {
          id: item.id,
          name: item.name,
          category: item.category,
          description: item.description,
          isActive: item.isActive,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ ExpenseTypes imported')
  }

  // Import Expenses
  if (data.tables.Expense?.length > 0) {
    console.log(`💰 Importing ${data.tables.Expense.length} Expenses...`)
    for (const item of data.tables.Expense) {
      await db.expense.create({
        data: {
          id: item.id,
          sellerId: item.sellerId,
          agentId: item.agentId,
          orderId: item.orderId,
          category: item.category,
          expenseTypeId: item.expenseTypeId,
          amount: item.amount,
          description: item.description,
          incurredAt: new Date(item.incurredAt)
        }
      })
    }
    console.log('✅ Expenses imported')
  }

  // Import Integrations
  if (data.tables.Integration?.length > 0) {
    console.log(`🔗 Importing ${data.tables.Integration.length} Integrations...`)
    for (const item of data.tables.Integration) {
      await db.integration.create({
        data: {
          id: item.id,
          sellerId: item.sellerId,
          platform: item.platform,
          secret: item.secret,
          isActive: item.isActive,
          lastHit: item.lastHit ? new Date(item.lastHit) : null,
          createdAt: new Date(item.createdAt),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
        }
      })
    }
    console.log('✅ Integrations imported')
  }

  // Import GoogleSheets
  if (data.tables.GoogleSheet?.length > 0) {
    console.log(`📊 Importing ${data.tables.GoogleSheet.length} GoogleSheets...`)
    for (const item of data.tables.GoogleSheet) {
      await db.googleSheet.create({
        data: {
          id: item.id,
          sellerId: item.sellerId,
          spreadsheetId: item.spreadsheetId,
          sheetName: item.sheetName,
          lastSyncedAt: item.lastSyncedAt ? new Date(item.lastSyncedAt) : null,
          lastSyncStatus: item.lastSyncStatus,
          lastSyncError: item.lastSyncError,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ GoogleSheets imported')
  }

  // Import ApiKeys
  if (data.tables.ApiKey?.length > 0) {
    console.log(`🔑 Importing ${data.tables.ApiKey.length} ApiKeys...`)
    for (const item of data.tables.ApiKey) {
      await db.apiKey.create({
        data: {
          id: item.id,
          sellerId: item.sellerId,
          key: item.key,
          lastUsedAt: item.lastUsedAt ? new Date(item.lastUsedAt) : null,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ ApiKeys imported')
  }

  // Import CatalogProducts
  if (data.tables.CatalogProduct?.length > 0) {
    console.log(`📚 Importing ${data.tables.CatalogProduct.length} CatalogProducts...`)
    for (const item of data.tables.CatalogProduct) {
      await db.catalogProduct.create({
        data: {
          id: item.id,
          name: item.name,
          description: item.description,
          imageUrl: item.imageUrl,
          costPrice: item.costPrice,
          category: item.category,
          countryAvailable: item.countryAvailable,
          isActive: item.isActive,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ CatalogProducts imported')
  }

  // Import CatalogFavorites
  if (data.tables.CatalogFavorite?.length > 0) {
    console.log(`⭐ Importing ${data.tables.CatalogFavorite.length} CatalogFavorites...`)
    for (const item of data.tables.CatalogFavorite) {
      await db.catalogFavorite.create({
        data: {
          id: item.id,
          sellerId: item.sellerId,
          catalogProductId: item.catalogProductId,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ CatalogFavorites imported')
  }

  // Import SourcingRequests
  if (data.tables.SourcingRequest?.length > 0) {
    console.log(`🛒 Importing ${data.tables.SourcingRequest.length} SourcingRequests...`)
    for (const item of data.tables.SourcingRequest) {
      await db.sourcingRequest.create({
        data: {
          id: item.id,
          sellerId: item.sellerId,
          productName: item.productName,
          description: item.description,
          referenceUrl: item.referenceUrl,
          images: item.images,
          quantity: item.quantity,
          country: item.country,
          shippingMethod: item.shippingMethod,
          trackingDetails: item.trackingDetails,
          type: item.type,
          status: item.status,
          adminNote: item.adminNote,
          receivedQty: item.receivedQty,
          receivedImages: item.receivedImages,
          damagedQty: item.damagedQty,
          createdAt: new Date(item.createdAt),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
          reviewedAt: item.reviewedAt ? new Date(item.reviewedAt) : null,
          reviewedBy: item.reviewedBy,
          inTransitAt: item.inTransitAt ? new Date(item.inTransitAt) : null,
          receivedAt: item.receivedAt ? new Date(item.receivedAt) : null,
          stockedAt: item.stockedAt ? new Date(item.stockedAt) : null
        }
      })
    }
    console.log('✅ SourcingRequests imported')
  }

  // Import CallRecordings
  if (data.tables.CallRecording?.length > 0) {
    console.log(`🎙️  Importing ${data.tables.CallRecording.length} CallRecordings...`)
    for (const item of data.tables.CallRecording) {
      await db.callRecording.create({
        data: {
          id: item.id,
          orderId: item.orderId,
          agentId: item.agentId,
          twilioCallSid: item.twilioCallSid,
          recordingUrl: item.recordingUrl,
          recordingSid: item.recordingSid,
          durationSeconds: item.durationSeconds,
          status: item.status,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ CallRecordings imported')
  }

  // Import NotificationLogs
  if (data.tables.NotificationLog?.length > 0) {
    console.log(`📬 Importing ${data.tables.NotificationLog.length} NotificationLogs...`)
    for (const item of data.tables.NotificationLog) {
      await db.notificationLog.create({
        data: {
          id: item.id,
          orderId: item.orderId,
          type: item.type,
          channel: item.channel,
          phone: item.phone,
          message: item.message,
          status: item.status,
          sentAt: new Date(item.sentAt)
        }
      })
    }
    console.log('✅ NotificationLogs imported')
  }

  // Import Invoices
  if (data.tables.Invoice?.length > 0) {
    console.log(`📄 Importing ${data.tables.Invoice.length} Invoices...`)
    for (const item of data.tables.Invoice) {
      await db.invoice.create({
        data: {
          id: item.id,
          sellerId: item.sellerId,
          deliveryManId: item.deliveryManId,
          ref: item.ref,
          cashCollected: item.cashCollected,
          refundedAmount: item.refundedAmount,
          subtotal: item.subtotal,
          vat: item.vat,
          totalNet: item.totalNet,
          status: item.status,
          cycleType: item.cycleType,
          dateFrom: new Date(item.dateFrom),
          dateTo: new Date(item.dateTo),
          isLocked: item.isLocked,
          lockedAt: item.lockedAt ? new Date(item.lockedAt) : null,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ Invoices imported')
  }

  // Import InvoiceLineItems
  if (data.tables.InvoiceLineItem?.length > 0) {
    console.log(`📋 Importing ${data.tables.InvoiceLineItem.length} InvoiceLineItems...`)
    for (const item of data.tables.InvoiceLineItem) {
      await db.invoiceLineItem.create({
        data: {
          id: item.id,
          invoiceId: item.invoiceId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          category: item.category,
          orderId: item.orderId,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ InvoiceLineItems imported')
  }

  // Import RemittanceLocks
  if (data.tables.RemittanceLock?.length > 0) {
    console.log(`🔒 Importing ${data.tables.RemittanceLock.length} RemittanceLocks...`)
    for (const item of data.tables.RemittanceLock) {
      await db.remittanceLock.create({
        data: {
          id: item.id,
          deliveryManId: item.deliveryManId,
          periodStart: new Date(item.periodStart),
          periodEnd: new Date(item.periodEnd),
          cashCollected: item.cashCollected,
          deliveryCount: item.deliveryCount,
          totalFees: item.totalFees,
          netDue: item.netDue,
          invoiceId: item.invoiceId,
          status: item.status,
          lockedAt: new Date(item.lockedAt),
          unlockedAt: item.unlockedAt ? new Date(item.unlockedAt) : null,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ RemittanceLocks imported')
  }

  // Import WebhookActivities
  if (data.tables.WebhookActivity?.length > 0) {
    console.log(`🔌 Importing ${data.tables.WebhookActivity.length} WebhookActivities...`)
    for (const item of data.tables.WebhookActivity) {
      await db.webhookActivity.create({
        data: {
          id: item.id,
          platform: item.platform,
          status: item.status,
          eventType: item.eventType,
          orderId: item.orderId,
          trackingNumber: item.trackingNumber,
          reason: item.reason,
          payload: item.payload,
          ipAddress: item.ipAddress,
          headers: item.headers,
          integrationId: item.integrationId,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ WebhookActivities imported')
  }

  // Import StockSnapshots
  if (data.tables.StockSnapshot?.length > 0) {
    console.log(`📸 Importing ${data.tables.StockSnapshot.length} StockSnapshots...`)
    for (const item of data.tables.StockSnapshot) {
      await db.stockSnapshot.create({
        data: {
          id: item.id,
          productId: item.productId,
          date: new Date(item.date),
          initialStock: item.initialStock,
          inForDelivery: item.inForDelivery,
          outForDelivery: item.outForDelivery,
          finalStock: item.finalStock,
          snapshotDate: new Date(item.snapshotDate)
        }
      })
    }
    console.log('✅ StockSnapshots imported')
  }

  // Import WithdrawalRequests
  if (data.tables.WithdrawalRequest?.length > 0) {
    console.log(`💸 Importing ${data.tables.WithdrawalRequest.length} WithdrawalRequests...`)
    for (const item of data.tables.WithdrawalRequest) {
      await db.withdrawalRequest.create({
        data: {
          id: item.id,
          walletId: item.walletId,
          amount: item.amount,
          method: item.method,
          account: item.account,
          status: item.status,
          requestedAt: new Date(item.requestedAt),
          processedAt: item.processedAt ? new Date(item.processedAt) : null,
          processedBy: item.processedBy,
          note: item.note
        }
      })
    }
    console.log('✅ WithdrawalRequests imported')
  }

  // Import DeliveryLocations
  if (data.tables.DeliveryLocation?.length > 0) {
    console.log(`📍 Importing ${data.tables.DeliveryLocation.length} DeliveryLocations...`)
    for (const item of data.tables.DeliveryLocation) {
      await db.deliveryLocation.create({
        data: {
          id: item.id,
          driverId: item.driverId,
          lat: item.lat,
          lng: item.lng,
          address: item.address,
          accuracy: item.accuracy,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ DeliveryLocations imported')
  }

  // Import TwilioSettings
  if (data.tables.TwilioSettings?.length > 0) {
    console.log(`📞 Importing ${data.tables.TwilioSettings.length} TwilioSettings...`)
    for (const item of data.tables.TwilioSettings) {
      await db.twilioSettings.create({
        data: {
          id: item.id,
          accountSid: item.accountSid,
          authToken: item.authToken,
          apiKey: item.apiKey,
          apiSecret: item.apiSecret,
          twimlAppSid: item.twimlAppSid,
          phoneNumber: item.phoneNumber,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
        }
      })
    }
    console.log('✅ TwilioSettings imported')
  }

  // Import CarrierSettings
  if (data.tables.CarrierSettings?.length > 0) {
    console.log(`🚚 Importing ${data.tables.CarrierSettings.length} CarrierSettings...`)
    for (const item of data.tables.CarrierSettings) {
      await db.carrierSettings.create({
        data: {
          id: item.id,
          name: item.name,
          apiKey: item.apiKey,
          apiSecret: item.apiSecret,
          isActive: item.isActive,
          webhookUrl: item.webhookUrl,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
        }
      })
    }
    console.log('✅ CarrierSettings imported')
  }

  // Import Admins
  if (data.tables.Admin?.length > 0) {
    console.log(`👑 Importing ${data.tables.Admin.length} Admins...`)
    for (const item of data.tables.Admin) {
      await db.admin.create({
        data: {
          id: item.id,
          email: item.email,
          password: item.password,
          name: item.name,
          role: item.role,
          status: item.status,
          lastLoginAt: item.lastLoginAt ? new Date(item.lastLoginAt) : null,
          forcePasswordChange: item.forcePasswordChange,
          createdBy: item.createdBy,
          createdAt: new Date(item.createdAt),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
        }
      })
    }
    console.log('✅ Admins imported')
  }

  // Import AuditLogs
  if (data.tables.AuditLog?.length > 0) {
    console.log(`📋 Importing ${data.tables.AuditLog.length} AuditLogs...`)
    for (const item of data.tables.AuditLog) {
      await db.auditLog.create({
        data: {
          id: item.id,
          adminId: item.adminId,
          userName: item.userName,
          userRole: item.userRole,
          action: item.action,
          targetType: item.targetType,
          targetId: item.targetId,
          details: item.details,
          ipAddress: item.ipAddress,
          impersonatingId: item.impersonatingId,
          impersonatorId: item.impersonatorId,
          createdAt: new Date(item.createdAt)
        }
      })
    }
    console.log('✅ AuditLogs imported')
  }

  // ── Summary ────────────────────────────────────────────────────────
  console.log('\n🎉 Import complete!\n')
  console.log('─────────────────────────────────────────────')
  console.log('IMPORTED USERS')
  console.log('─────────────────────────────────────────────')

  const users = data.tables.User
  const admins = users.filter(u => u.role === 'ADMIN')
  const sellers = users.filter(u => u.role === 'SELLER')
  const agents = users.filter(u => u.role === 'CALL_CENTER')
  const delivery = users.filter(u => u.role === 'DELIVERY')

  console.log('\n🔑 ADMIN ACCOUNTS:')
  admins.forEach(u => console.log(`   ${u.email} (password already set)`))

  console.log('\n🛒 SELLER ACCOUNTS:')
  sellers.forEach(u => console.log(`   ${u.email}`))

  console.log('\n📞 CALL CENTER AGENTS:')
  agents.forEach(u => console.log(`   ${u.email}`))

  console.log('\n🚚 DELIVERY AGENTS:')
  delivery.forEach(u => console.log(`   ${u.email}`))

  console.log('\n─────────────────────────────────────────────')
  console.log(`Total Users: ${users.length}`)
  console.log(`Total Products: ${data.tables.Product?.length || 0}`)
  console.log(`Total Orders: ${data.tables.Order?.length || 0}`)
  console.log('─────────────────────────────────────────────')
}

main()
  .catch((e) => { console.error('❌ Import failed:', e); process.exit(1) })
  .finally(() => db.$disconnect())
