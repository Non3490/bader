import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const counts = {
    User: await prisma.user.count(),
    Order: await prisma.order.count(),
    CallLog: await prisma.callLog.count(),
    Product: await prisma.product.count(),
    OrderHistory: await prisma.orderHistory.count(),
    Stock: await prisma.stock.count(),
    Wallet: await prisma.wallet.count(),
    ActivityLog: await prisma.activityLog.count(),
  }

  console.log('Database Record Counts:')
  console.table(counts)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
