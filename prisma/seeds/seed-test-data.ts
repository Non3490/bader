import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting test data seeding...')

  // Create Sellers
  const sellersData = [
    { name: 'Hervé', email: 'herve@test.gaboncod.com', role: 'SELLER' },
    { name: 'Chancelle', email: 'chancelle@test.gaboncod.com', role: 'SELLER' },
    { name: 'Patrick', email: 'patrick@test.gaboncod.com', role: 'SELLER' },
    { name: 'Laure', email: 'laure@test.gaboncod.com', role: 'SELLER' },
  ]

  console.log('👤 Creating sellers...')
  const sellers: any[] = []
  for (const sData of sellersData) {
    let seller = await prisma.user.findFirst({ where: { email: sData.email } })
    if (!seller) {
      seller = await prisma.user.create({
        data: {
          email: sData.email,
          password: await bcrypt.hash('seller123', 10),
          name: sData.name,
          role: sData.role,
          isActive: true,
        }
      })
      console.log(`  ✅ Created seller: ${sData.name}`)
    } else {
      console.log(`  ℹ️ Seller exists: ${sData.name}`)
    }
    sellers.push(seller)
  }

  // Test products
  const productsBase = [
    { name: 'Blender Portable', sku: 'BLD-001', costPrice: 5000, sellPrice: 15000 },
    { name: 'Ceinture Minceur', sku: 'CMN-001', costPrice: 4000, sellPrice: 12000 },
    { name: 'Lampe Solaire', sku: 'LSP-001', costPrice: 3000, sellPrice: 8000 },
    { name: 'Fer à Lisser', sku: 'FLR-001', costPrice: 3500, sellPrice: 18000 },
  ]

  console.log('📦 Creating seller products and stock...')
  const createdProducts: any[] = []
  for (let i = 0; i < sellers.length; i++) {
    const seller = sellers[i]
    const pBase = productsBase[i]
    
    let product = await prisma.product.findFirst({
      where: { sellerId: seller.id, name: pBase.name }
    })

    if (!product) {
      product = await prisma.product.create({
        data: {
          sellerId: seller.id,
          sku: pBase.sku,
          name: pBase.name,
          costPrice: pBase.costPrice,
          sellPrice: pBase.sellPrice,
          isActive: true,
        }
      })
      console.log(`  ✅ Created product for ${seller.name}: ${pBase.name}`)
    }
    createdProducts.push(product)

    // Stock
    const stockQty = [60, 40, 90, 30][i]
    const existingStock = await prisma.stock.findFirst({
      where: { sellerId: seller.id, productId: product.id }
    })
    if (!existingStock) {
      await prisma.stock.create({
        data: {
          sellerId: seller.id,
          productId: product.id,
          warehouse: 'Libreville',
          quantity: stockQty,
          alertLevel: 10,
        }
      })
      console.log(`  ✅ Created stock for ${seller.name}: ${product.name} (${stockQty} units)`)
    }
  }

  // Create Call Center Agents
  const agentsData = [
    { name: 'Agent 1', email: 'agent1@gaboncod.com', role: 'CALL_CENTER' },
    { name: 'Agent 2', email: 'agent2@gaboncod.com', role: 'CALL_CENTER' },
  ]

  console.log('📞 Creating call center agents...')
  const agents: any[] = []
  for (const aData of agentsData) {
    let agent = await prisma.user.findFirst({ where: { email: aData.email } })
    if (!agent) {
      agent = await prisma.user.create({
        data: {
          email: aData.email,
          password: await bcrypt.hash('agent123', 10),
          name: aData.name,
          role: aData.role,
          isActive: true,
        }
      })
      console.log(`  ✅ Created agent: ${aData.name}`)
    }
    agents.push(agent)
  }

  // Create Delivery Men
  const deliveryMenData = [
    { name: 'Jean-Claude', email: 'jeanclaude@gaboncod.com', role: 'DELIVERY', phone: '+241000000' },
    { name: 'Rodrigue', email: 'rodrigue@gaboncod.com', role: 'DELIVERY', phone: '+241000001' },
  ]

  console.log('🚚 Creating delivery men...')
  const deliveryMen: any[] = []
  for (const dmData of deliveryMenData) {
    let dm = await prisma.user.findFirst({ where: { email: dmData.email } })
    if (!dm) {
      dm = await prisma.user.create({
        data: {
          email: dmData.email,
          password: await bcrypt.hash('deliv123', 10),
          name: dmData.name,
          role: dmData.role,
          phone: dmData.phone,
          isActive: true,
        }
      })
      console.log(`  ✅ Created delivery man: ${dmData.name}`)
    }
    deliveryMen.push(dm)
  }

  // Create Zones
  console.log('📍 Creating zones...')
  const zones = [
    { id: 'zone_libreville', name: 'Libreville Centre', city: 'Libreville' },
    { id: 'zone_portgentil', name: 'Port-Gentil', city: 'Port-Gentil' },
  ]

  for (const zone of zones) {
    const existing = await prisma.zone.findUnique({ where: { id: zone.id } })
    if (!existing) {
      await prisma.zone.create({ data: zone })
      console.log(`  ✅ Created zone: ${zone.name}`)
    }
  }

  // Assign delivery men to zones
  await prisma.user.update({
    where: { id: deliveryMen[0].id },
    data: { zoneId: 'zone_libreville' }
  })
  await prisma.user.update({
    where: { id: deliveryMen[1].id },
    data: { zoneId: 'zone_portgentil' }
  })

  // Create Wallets
  console.log('💰 Creating seller wallets...')
  for (const seller of sellers) {
    const existingWallet = await prisma.wallet.findUnique({ where: { sellerId: seller.id } })
    if (!existingWallet) {
      await prisma.wallet.create({
        data: {
          sellerId: seller.id,
          balance: 0,
          totalEarned: 0,
          totalDeducted: 0,
        }
      })
      console.log(`  ✅ Created wallet for: ${seller.name}`)
    }
  }

  // Create Orders
  console.log('📋 Creating 100 orders...')
  const cities = ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem']
  let orderCounter = 0
  
  for (let i = 0; i < 100; i++) {
    const seller = sellers[i % sellers.length]
    const product = createdProducts[i % createdProducts.length]
    const city = cities[i % cities.length]
    const status = ['NEW', 'CONFIRMED', 'DELIVERED', 'CANCELLED'][Math.floor(Math.random() * 4)]
    
    const trackingNumber = `GAB${Date.now().toString(36)}${i.toString().padStart(3, '0')}`.toUpperCase()

    const order = await prisma.order.create({
      data: {
        trackingNumber,
        sellerId: seller.id,
        recipientName: getRandomName(),
        phone: getRandomPhone(),
        address: `${city}, neighborhood ${i}`,
        city: city,
        codAmount: product.sellPrice,
        status: status,
        source: 'MANUAL',
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
      }
    })

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        quantity: 1,
        unitPrice: product.sellPrice,
      }
    })

    if (status !== 'NEW') {
      await prisma.callLog.create({
        data: {
          orderId: order.id,
          agentId: agents[Math.floor(Math.random() * agents.length)].id,
          attempt: status === 'CONFIRMED' || status === 'DELIVERED' ? 'ANSWERED' : 'CANCELLED',
          createdAt: order.createdAt,
        }
      })
    }
    orderCounter++
  }

  console.log(`  ✅ Created ${orderCounter} orders`)
  console.log('\n🎉 Seeding complete!')
}

function getRandomName() {
  const first = ['Jean', 'Paul', 'Marie', 'François', 'Sophie', 'André', 'Aïcha']
  const last = ['Moussa', 'Nguema', 'Bekale', 'Nze', 'Moubamba', 'Ondo']
  return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`
}

function getRandomPhone() {
  return `+2410${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
