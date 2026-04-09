import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting test data seeding...')

  // Test products (from the scenario)
  const products = [
    { name: 'Blender Portable', sku: 'BLD-001', costPrice: 5000, sellPrice: 15000 },
    { name: 'Ceinture Minceur', sku: 'CMN-001', costPrice: 4000, sellPrice: 12000 },
    { name: 'Lampe Solaire', sku: 'LSP-001', costPrice: 3000, sellPrice: 8000 },
    { name: 'Fer à Lisser', sku: 'FLR-001', costPrice: 3500, sellPrice: 18000 },
    { name: 'Brosse Électrique', sku: 'BRU-001', costPrice: 2000, sellPrice: 10000 },
  ]

  console.log('📦 Creating products...')
  for (const product of products) {
    const existing = await prisma.product.findFirst({ where: { name: product.name } })
    if (!existing) {
      await prisma.product.create({
        data: {
          name: product.name,
          sku: product.sku,
          costPrice: product.costPrice,
          sellPrice: product.sellPrice,
          isActive: true,
        }
      })
      console.log(`  ✅ Created: ${product.name}`)
    }
  }

  // Create Sellers
  const sellersData = [
    { name: 'Hervé', email: 'herve@test.gaboncod.com', role: 'SELLER' },
    { name: 'Chancelle', email: 'chancelle@test.gaboncod.com', role: 'SELLER' },
    { name: 'Patrick', email: 'patrick@test.gaboncod.com', role: 'SELLER' },
    { name: 'Laure', email: 'laure@test.gaboncod.com', role: 'SELLER' },
  ]

  console.log('👤 Creating sellers...')
  const sellers = []
  for (const sellerData of sellersData) {
    const existing = await prisma.user.findFirst({ where: { email: sellerData.email } })
    let sellerId
    if (existing) {
      sellerId = existing.id
      console.log(`  ℹ️ Seller exists: ${sellerData.name}`)
    } else {
      const seller = await prisma.user.create({
        data: {
          email: sellerData.email,
          password: await bcrypt.hash('seller123', 10),
          name: sellerData.name,
          role: sellerData.role,
          isActive: true,
        }
      })
      sellerId = seller.id
      console.log(`  ✅ Created seller: ${sellerData.name}`)
    }
    sellers.push({ id: sellerId, email: sellerData.email, name: sellerData.name, role: sellerData.role })
  }

  // Create Products for each seller and get IDs
  console.log('📦 Creating seller products and stock...')
  const stockQtys = { 'Hervé': 60, 'Chancelle': 40, 'Patrick': 90, 'Laure': 30 }

  const productMap = {}
  for (const seller of sellers) {
    const product = products.find(p => p.name === seller.name)
    if (!product) continue

    let productId
    const existingSellerProduct = await prisma.product.findFirst({
      where: { sellerId: seller.id, name: product.name }
    })

    if (existingSellerProduct) {
      productId = existingSellerProduct.id
    } else {
      const newSellerProduct = await prisma.product.create({
        data: {
          sellerId: seller.id,
          name: product.name,
          sku: product.sku,
          costPrice: product.costPrice,
          sellPrice: product.sellPrice,
          isActive: true,
        }
      })
      productId = newSellerProduct.id
    }

    productMap[seller.name] = productId

    // Create stock entry
    const qty = stockQtys[seller.name] || 0
    if (qty > 0) {
      await prisma.stock.create({
        data: {
          sellerId: seller.id,
          productId: productId,
          warehouse: 'Libreville',
          quantity: qty,
          alertLevel: 10,
        }
      })
      console.log(`  ✅ Created stock for ${seller.name}: ${product.name} (${qty} units)`)
    }
  }

  // Create Call Center Agents
  const agentsData = [
    { name: 'Agent 1', email: 'agent1@gaboncod.com', role: 'CALL_CENTER' },
    { name: 'Agent 2', email: 'agent2@gaboncod.com', role: 'CALL_CENTER' },
    { name: 'Agent 3', email: 'agent3@gaboncod.com', role: 'CALL_CENTER' },
  ]

  console.log('📞 Creating call center agents...')
  const agents = []
  for (const agentData of agentsData) {
    const existing = await prisma.user.findFirst({ where: { email: agentData.email } })
    let agentId
    if (existing) {
      agentId = existing.id
      console.log(`  ℹ️ Agent exists: ${agentData.name}`)
    } else {
      const agent = await prisma.user.create({
        data: {
          email: agentData.email,
          password: await bcrypt.hash('agent123', 10),
          name: agentData.name,
          role: agentData.role,
          isActive: true,
        }
      })
      agentId = agent.id
      console.log(`  ✅ Created agent: ${agentData.name}`)
    }
    agents.push({ id: agentId, ...agentData })
  }

  // Create Delivery Men
  const deliveryMenData = [
    { name: 'Jean-Claude', email: 'jeanclaude@gaboncod.com', role: 'DELIVERY', phone: '+241000000' },
    { name: 'Rodrigue', email: 'rodrigue@gaboncod.com', role: 'DELIVERY', phone: '+241000001' },
  ]

  console.log('🚚 Creating delivery men...')
  const deliveryMen = []
  for (const dmData of deliveryMenData) {
    const existing = await prisma.user.findFirst({ where: { email: dmData.email } })
    let dmId
    if (existing) {
      dmId = existing.id
      console.log(`  ℹ️ Delivery man exists: ${dmData.name}`)
    } else {
      const dm = await prisma.user.create({
        data: {
          email: dmData.email,
          password: await bcrypt.hash('deliv123', 10),
          name: dmData.name,
          role: dmData.role,
          phone: dmData.phone,
          isActive: true,
        }
      })
      dmId = dm.id
      console.log(`  ✅ Created delivery man: ${dmData.name}`)
    }
    deliveryMen.push({ id: dmId, ...dmData })
  }

  // Create Zones
  const zones = [
    { id: 'zone_libreville', name: 'Libreville Centre', city: 'Libreville' },
    { id: 'zone_pk5', name: 'PK5-PK12 Zone', city: 'Libreville' },
    { id: 'zone_akanda', name: 'Akanda Zone', city: 'Libreville' },
    { id: 'zone_owendo', name: 'Owendo Zone', city: 'Libreville' },
    { id: 'zone_portgentil', name: 'Port-Gentil', city: 'Port-Gentil' },
  ]

  for (const zone of zones) {
    const existing = await prisma.zone.findFirst({ where: { id: zone.id } })
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

  // Create Wallets for sellers
  console.log('💰 Creating seller wallets...')
  for (const seller of sellers) {
    const existingWallet = await prisma.wallet.findFirst({ where: { sellerId: seller.id } })
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

  // Create Orders (Leads) - 200 orders distributed across sellers
  console.log('📋 Creating 200 orders...')

  const cities = ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem']
  const statuses = ['NEW', 'CONFIRMED', 'DELIVERED', 'CANCELLED', 'NO_ANSWER', 'RETURNED']

  const orderCountPerSeller = {
    'Hervé': 60,
    'Chancelle': 45,
    'Patrick': 50,
    'Laure': 45,
  }

  const codAmounts = {
    'Hervé': 15000,
    'Chancelle': 12000,
    'Patrick': 8000,
    'Laure': 18000,
  }

  let orderCounter = 0
  const today = new Date()

  for (const seller of sellers) {
    const count = orderCountPerSeller[seller.name]
    if (!count) continue

    const productId = productMap[seller.name]
    const codAmount = codAmounts[seller.name] || 15000
    const baseTracking = `GAB${Date.now().toString(36).substring(2, 8)}${orderCounter.toString().padStart(5, '0')}`

    const orderStatuses = [
      ...Array(Math.floor(count * 0.55)).fill('CONFIRMED'),
      ...Array(Math.floor(count * 0.25)).fill('DELIVERED'),
      ...Array(Math.floor(count * 0.10)).fill('CANCELLED'),
      ...Array(Math.floor(count * 0.05)).fill('NO_ANSWER'),
      ...Array(Math.floor(count * 0.03)).fill('RETURNED'),
      ...Array(Math.floor(count * 0.02)).fill('NEW'),
    ].slice(0, count)

    const shuffledCities = [...cities].sort(() => Math.random() - 0.5)

    for (let i = 0; i < count; i++) {
      const status = orderStatuses[i] || 'NEW'
      const city = shuffledCities[i % shuffledCities.length]
      const orderDate = new Date(today.getTime() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000))

      const order = await prisma.order.create({
        data: {
          id: `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${i}`,
          trackingNumber: `${baseTracking}${i.toString().padStart(3, '0')}`,
          sellerId: seller.id,
          recipientName: getRandomName(),
          phone: getRandomPhone(),
          address: getRandomAddress(city),
          city: city,
          productName: product.name,
          codAmount: codAmount,
          status: status,
          source: 'MANUAL',
          confirmedAt: status === 'CONFIRMED' ? orderDate : null,
          deliveredAt: status === 'DELIVERED' ? orderDate : null,
          cancelledAt: status === 'CANCELLED' ? orderDate : null,
          createdAt: orderDate,
        }
      })
      orderCounter++

      // Create order item
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: productId,
          quantity: 1,
          unitPrice: codAmount,
        }
      })

      // Create call log for confirmed/cancelled
      if (['CONFIRMED', 'CANCELLED', 'NO_ANSWER'].includes(status)) {
        const attemptMap = {
          'CONFIRMED': 'ANSWERED',
          'CANCELLED': 'CANCELLED',
          'NO_ANSWER': 'NO_ANSWER',
        }
        await prisma.callLog.create({
          data: {
            orderId: order.id,
            agentId: agents[Math.floor(Math.random() * agents.length)].id,
            attempt: attemptMap[status],
            comment: null,
            createdAt: orderDate,
          }
        })
      }
    }
  }

  console.log(`  ✅ Created ${orderCounter} orders`)

  console.log('\n📊 Test Data Summary:')
  console.log('====================')
  console.log(`Sellers: ${sellers.length}`)
  console.log(`Call Center Agents: ${agents.length}`)
  console.log(`Delivery Men: ${deliveryMen.length}`)
  console.log(`Zones: ${zones.length}`)
  console.log(`Orders Created: ${orderCounter}`)
  console.log('====================')
  console.log('\n🔑 Login Credentials:')
  console.log('-------------------')
  console.log('SELLERS (Password: seller123):')
  for (const seller of sellers) {
    console.log(`  - ${seller.email} (${seller.name})`)
  }
  console.log('\nCALL CENTER AGENTS (Password: agent123):')
  for (const agent of agents) {
    console.log(`  - ${agent.email} (${agent.name})`)
  }
  console.log('\nDELIVERY MEN (Password: deliv123):')
  for (const dm of deliveryMen) {
    console.log(`  - ${dm.email} (${dm.name})`)
  }
  console.log('-------------------')
}

function getRandomName() {
  const firstNames = ['Jean', 'Paul', 'Marie', 'François', 'Célestine', 'Marc', 'Sophie', 'André', 'Patrice', 'Aïcha', 'Christian', 'Brigitte', 'Luc', 'Emma', 'Nadia', 'Karl', 'Isabelle']
  const lastNames = ['Moussa', 'Nguema', 'Bekale', 'Nze', 'Moubamba', 'Mboumba', 'Ondo', 'Eyene', 'Moundounga', 'Owono', 'Nkoghe', 'Mendame', 'Elonga', 'Edima', 'Nzeng', 'Mabika', 'Obame', 'Bikambi']

  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`
}

function getRandomPhone() {
  const prefixes = ['074', '062', '055', '043']
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  const suffix = Math.floor(Math.random() * 1000000).toString().padStart(7, '0')
  return `+241${prefix}${suffix}`
}

function getRandomAddress(city) {
  const neighborhoods = {
    'Libreville': ['Akanda', 'PK5', 'Louis', 'Nombakélé', 'Owendo'],
    'Port-Gentil': ['Downtown', 'Zone Industrielle', 'Port'],
    'Franceville': ['Centre', 'Quartier Sud'],
    'Oyem': ['Centre ville', 'Quartier Est'],
  }

  const areas = neighborhoods[city] || ['Centre']
  const area = areas[Math.floor(Math.random() * areas.length)]
  const houseNum = Math.floor(Math.random() * 200) + 1

  return `${area}, Maison ${houseNum}`
}

main()
  .catch((e) => {
    console.error('Error seeding test data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    console.log('\n✅ Database disconnected')
  })
