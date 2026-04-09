import { db } from '@/lib/db'
import { ensureWallet, creditWallet, debitWallet } from '@/lib/wallet-service'

export async function getFinanceOverview(userId: string, role: string, period: string = '30d') {
  const date = getDateFromPeriod(period)

  let where: any = {
    createdAt: { gte: date }
  }

  if (role === 'SELLER') {
    where.sellerId = userId
  }

  // Revenue from delivered orders
  const orders = await db.order.findMany({
    where: { ...where, status: 'DELIVERED' },
    select: { codAmount: true, platformFee: true }
  })

  const revenue = orders.reduce((sum, o) => sum + o.codAmount, 0)
  const platformFees = orders.reduce((sum, o) => sum + o.platformFee, 0)

  // Expenses
  const expenses = await db.expense.findMany({
    where: {
      ...where,
      ...(role === 'SELLER' ? { sellerId: userId } : {}),
      category: { in: ['SHIPPING', 'SOURCING', 'AD_SPEND', 'OTHER'] }
    },
    select: { amount: true }
  })

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  // Call center expenses (admin only)
  let callCenterExpenses = 0
  if (role !== 'SELLER') {
    const ccExpenses = await db.expense.findMany({
      where: { ...where, category: 'CALL_CENTER' },
      select: { amount: true }
    })
    callCenterExpenses = ccExpenses.reduce((sum, e) => sum + e.amount, 0)
  }

  // Delivery fees (admin only)
  let deliveryFees = 0
  if (role !== 'SELLER') {
    const deliveryFeeExpenses = await db.expense.findMany({
      where: { ...where, category: 'DELIVERY' },
      select: { amount: true }
    })
    deliveryFees = deliveryFeeExpenses.reduce((sum, e) => sum + e.amount, 0)
  }

  const totalAllExpenses = totalExpenses + callCenterExpenses + deliveryFees
  const netProfit = revenue - totalAllExpenses

  // Pending withdrawals
  let pendingWithdrawals = 0
  if (role !== 'SELLER') {
    pendingWithdrawals = await db.withdrawalRequest.count({
      where: { status: 'PENDING' }
    })
  } else {
    pendingWithdrawals = await db.withdrawalRequest.count({
      where: { wallet: { sellerId: userId }, status: 'PENDING' }
    })
  }

  return {
    revenue,
    expenses: totalAllExpenses,
    netProfit,
    platformFees,
    callCenterExpenses,
    deliveryFees,
    pendingWithdrawals,
    sellerExpenses: totalExpenses,
    orderCount: orders.length
  }
}

export async function getFinanceBySeller(period: string = '30d') {
  const date = getDateFromPeriod(period)

  const sellers = await db.user.findMany({
    where: { role: 'SELLER' },
    include: {
      wallet: true,
      orders: {
        where: { status: 'DELIVERED', createdAt: { gte: date } },
        select: { codAmount: true, platformFee: true }
      },
      expenses: {
        where: { incurredAt: { gte: date } },
        select: { amount: true }
      }
    }
  })

  return sellers.map(seller => {
    const revenue = seller.orders.reduce((sum, o) => sum + o.codAmount, 0)
    const platformFees = seller.orders.reduce((sum, o) => sum + o.platformFee, 0)
    const expenses = seller.expenses.reduce((sum, e) => sum + e.amount, 0)
    const fees = platformFees + (expenses * 0.05) // 5% service fee

    return {
      sellerId: seller.id,
      sellerName: seller.name,
      sellerEmail: seller.email,
      revenue,
      expenses,
      fees,
      netProfit: revenue - expenses - fees,
      walletBalance: seller.wallet?.balance || 0
    }
  })
}

export async function createRemittanceLock(
  deliveryManId: string,
  periodStart: Date,
  periodEnd: Date,
  createdBy: string
) {
  // Get all delivered orders in period
  const orders = await db.order.findMany({
    where: {
      deliveryManId,
      status: 'DELIVERED',
      deliveredAt: {
        gte: periodStart,
        lte: periodEnd
      }
    },
    include: { seller: { include: { wallet: true } } }
  })

  const cashCollected = orders.reduce((sum, o) => sum + o.codAmount, 0)
  const deliveryCount = orders.length

  // Get delivery fee config
  const feeConfig = await db.deliveryFeeConfig.findUnique({
    where: { deliveryManId }
  })

  const totalFees = deliveryCount * (feeConfig?.costPerDelivery || 0)
  const netDue = cashCollected - totalFees

  // Create remittance lock
  const remittanceLock = await db.remittanceLock.create({
    data: {
      deliveryManId,
      periodStart,
      periodEnd,
      cashCollected,
      deliveryCount,
      totalFees,
      netDue,
      status: 'LOCKED'
    }
  })

  // Create invoice
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`
  const invoice = await db.invoice.create({
    data: {
      ref: invoiceNumber,
      deliveryManId,
      cashCollected,
      refundedAmount: 0,
      subtotal: cashCollected,
      vat: 0,
      totalNet: netDue,
      status: 'UNPAID',
      cycleType: 'DELIVERY',
      dateFrom: periodStart,
      dateTo: periodEnd,
      isLocked: true,
      lockedAt: new Date()
    }
  })

  // Create line items
  await db.invoiceLineItem.create({
    data: {
      invoiceId: invoice.id,
      description: 'Cash Collected',
      quantity: deliveryCount,
      unitPrice: 0,
      amount: cashCollected,
      category: 'ORDER'
    }
  })

  await db.invoiceLineItem.create({
    data: {
      invoiceId: invoice.id,
      description: 'Delivery Fees',
      quantity: deliveryCount,
      unitPrice: feeConfig?.costPerDelivery || 0,
      amount: -totalFees,
      category: 'FEE'
    }
  })

  // Link invoice to remittance lock
  await db.remittanceLock.update({
    where: { id: remittanceLock.id },
    data: { invoiceId: invoice.id }
  })

  return { remittanceLock, invoice }
}

export async function getRemittanceLocks(deliveryManId?: string) {
  const where = deliveryManId ? { deliveryManId } : {}

  return await db.remittanceLock.findMany({
    where,
    include: {
      deliveryMan: { select: { id: true, name: true, email: true } },
      invoice: true
    },
    orderBy: { lockedAt: 'desc' },
    take: 50
  })
}

export async function getDeliveryFeeConfig(deliveryManId: string) {
  return await db.deliveryFeeConfig.findUnique({
    where: { deliveryManId }
  })
}

export async function upsertDeliveryFeeConfig(
  deliveryManId: string,
  costPerDelivery: number,
  bonusAmount: number,
  penaltyAmount: number
) {
  return await db.deliveryFeeConfig.upsert({
    where: { deliveryManId },
    create: {
      deliveryManId,
      costPerDelivery,
      bonusAmount,
      penaltyAmount
    },
    update: {
      costPerDelivery,
      bonusAmount,
      penaltyAmount
    }
  })
}

export async function getAgentExpenses(agentId?: string, period: string = '30d') {
  const date = getDateFromPeriod(period)
  const where: any = {
    incurredAt: { gte: date },
    agentId: { not: null }
  }

  if (agentId) {
    where.agentId = agentId
  }

  return await db.expense.findMany({
    where,
    include: {
      agent: { select: { id: true, name: true, email: true } },
      expenseType: { select: { id: true, name: true } }
    },
    orderBy: { incurredAt: 'desc' },
    take: 100
  })
}

function getDateFromPeriod(period: string): Date {
  const now = new Date()
  switch (period) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}

export async function processWithdrawal(withdrawalId: string, action: 'approve' | 'reject', processedBy: string, note?: string) {
  const withdrawal = await db.withdrawalRequest.findUnique({
    where: { id: withdrawalId },
    include: { wallet: { include: { seller: true } } }
  })

  if (!withdrawal) {
    throw new Error('Withdrawal not found')
  }

  if (withdrawal.status !== 'PENDING') {
    throw new Error('Withdrawal already processed')
  }

  if (action === 'approve') {
    await debitWallet(
      withdrawal.wallet.sellerId,
      withdrawal.amount,
      `Withdrawal approved - ${withdrawal.method}`,
      withdrawalId
    )

    await db.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: 'APPROVED',
        processedAt: new Date(),
        processedBy,
        note
      }
    })
  } else {
    await db.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: 'REJECTED',
        processedAt: new Date(),
        processedBy,
        note
      }
    })
  }

  return withdrawal
}

export async function markWithdrawalAsPaid(withdrawalId: string) {
  return await db.withdrawalRequest.update({
    where: { id: withdrawalId },
    data: {
      status: 'PAID',
      processedAt: new Date()
    }
  })
}
