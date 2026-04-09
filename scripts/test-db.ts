import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testConnection() {
  try {
    await prisma.$connect()
    console.log('✅ Connected to new database!')

    const userCount = await prisma.user.count()
    const orderCount = await prisma.order.count()

    console.log(`   Users: ${userCount}`)
    console.log(`   Orders: ${orderCount}`)
  } catch (error: any) {
    console.error('❌ Connection failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
