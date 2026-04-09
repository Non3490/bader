/**
 * Simple seed script for CORE 03 Delivery Portal
 */

const { PrismaClient } = require('@prisma/client')
const { hash } = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding test drivers...')

  // Driver 1: PIN 1234
  const driver1 = await prisma.driver.upsert({
    where: { phone: '+24101234567' },
    update: {},
    create: {
      name: 'Jean Driver',
      phone: '+24101234567',
      pin: await hash('1234'),
      status: 'AVAILABLE',
      vehicleType: 'MOTORCYCLE',
      zone: 'Libreville North',
      isActive: true
    }
  })

  // Driver 2: PIN 5678
  const driver2 = await prisma.driver.upsert({
    where: { phone: '+24102345678' },
    update: {},
    create: {
      name: 'Marie Livreur',
      phone: '+24102345678',
      pin: await hash('5678'),
      status: 'OFFLINE',
      vehicleType: 'CAR',
      zone: 'Port-Gentil',
      isActive: true
    }
  })

  console.log('✅ Drivers created!')
  console.log('   PIN 1234: +24101234567 (Jean Driver)')
  console.log('   PIN 5678: +24102345678 (Marie Livreur)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
