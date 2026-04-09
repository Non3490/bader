import { PrismaClient } from '@prisma/client'

async function main() {
  const db = new PrismaClient()
  await db.driver.deleteMany({ where: { name: 'df' } })
  console.log('Test driver "df" deleted successfully')
  await db.$disconnect()
}

main().catch(console.error)
