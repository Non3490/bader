import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  console.log('=== DRIVER PORTAL ACCOUNTS ===')
  const drivers = await db.driver.findMany({
    select: { id: true, name: true, phone: true, status: true, isActive: true }
  })
  console.log(JSON.stringify(drivers, null, 2))

  console.log('\n=== USER DELIVERY ACCOUNTS (legacy) ===')
  const users = await db.user.findMany({
    where: { role: 'DELIVERY' },
    select: { id: true, name: true, phone: true, isActive: true }
  })
  console.log(JSON.stringify(users, null, 2))
}

main().finally(() => db.$disconnect())
