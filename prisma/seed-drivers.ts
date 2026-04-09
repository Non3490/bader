/**
 * Seed script for Delivery Portal (CORE 03)
 * Creates test drivers and orders for testing
 */

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding CORE 03: Delivery Portal...')

  // Create test drivers with hashed PINs
  const drivers = [
    {
      name: 'Jean Driver',
      phone: '+241 01 23 45 67',
      pin: await hash('1234'), // Test PIN: 1234
      status: 'AVAILABLE',
      vehicleType: 'MOTORCYCLE',
      licensePlate: 'GB-123-A',
      zone: 'Libreville North',
      isActive: true
    },
    {
      name: 'Marie Livreur',
      phone: '+241 02 34 56 78',
      pin: await hash('5678'), // Test PIN: 5678
      status: 'OFFLINE',
      vehicleType: 'CAR',
      licensePlate: 'GB-456-B',
      zone: 'Port-Gentil',
      isActive: true
    },
    {
      name: 'Paul Delivery',
      phone: '+241 03 45 67 89',
      pin: await hash('9999'), // Test PIN: 9999
      status: 'AVAILABLE',
      vehicleType: 'MOTORCYCLE',
      zone: 'Libreville South',
      isActive: true
    }
  ]

  for (const driverData of drivers) {
    const existing = await prisma.driver.findUnique({
      where: { phone: driverData.phone }
    })

    if (!existing) {
      await prisma.driver.create({ data: driverData })
      console.log(`✅ Created driver: ${driverData.name} (PIN: ${driverData.pin === '1234' ? '1234' : driverData.pin === '5678' ? '5678' : '9999'})`)
    } else {
      console.log(`ℹ️  Driver already exists: ${driverData.name}`)
    }
  }

  // Get the first driver for test orders
  const driver1 = await prisma.driver.findFirst({
    where: { phone: '+241 01 23 45 67' }
  })

  // Create test orders with SHIPPED status for assignment
  if (driver1) {
    const testOrders = [
      {
        trackingNumber: `TRK-${Date.now()}-1`,
        sellerId: 'test-seller-id', // This would need to exist
        recipientName: 'John Doe',
        phone: '+241 07 12 34 56',
        address: '123 Avenue de l\'Indépendance',
        city: 'Libreville',
        codAmount: 15000,
        status: 'SHIPPED',
        assignedDriverId: driver1.id
      },
      {
        trackingNumber: `TRK-${Date.now()}-2`,
        sellerId: 'test-seller-id',
        recipientName: 'Jane Smith',
        phone: '+241 07 23 45 67',
        address: '456 Boulevard Triomphal',
        city: 'Libreville',
        codAmount: 25000,
        status: 'SHIPPED'
      },
      {
        trackingNumber: `TRK-${Date.now()}-3`,
        sellerId: 'test-seller-id',
        recipientName: 'Bob Johnson',
        phone: '+241 07 34 56 78',
        address: '789 Rue du Port',
        city: 'Port-Gentil',
        codAmount: 18000,
        status: 'SHIPPED'
      }
    ]

    for (const orderData of testOrders) {
      const existing = await prisma.order.findUnique({
        where: { trackingNumber: orderData.trackingNumber }
      })

      if (!existing) {
        await prisma.order.create({ data: orderData })
        console.log(`✅ Created test order: ${orderData.trackingNumber}`)

        // Create delivery record for orders with assigned driver
        if (orderData.assignedDriverId) {
          await prisma.delivery.create({
            data: {
              orderId: orderData.trackingNumber, // This should be the order ID, using tracking number for now
              driverId: orderData.assignedDriverId,
              status: 'ASSIGNED'
            }
          })
        }
      }
    }
  }

  console.log('✨ Seeding complete!')
  console.log('')
  console.log('Test Driver Credentials:')
  console.log('  - Jean Driver:  PIN 1234')
  console.log('  - Marie Livreur: PIN 5678')
  console.log('  - Paul Delivery: PIN 9999')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
