import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding orders for call center...')

  // Get or create Call Center Agents
  const agentsData = [
    { name: 'Agent 1', email: 'agent1@gaboncod.com' },
    { name: 'Agent 2', email: 'agent2@gaboncod.com' },
    { name: 'Agent 3', email: 'agent3@gaboncod.com' },
  ]

  console.log('📞 Ensuring call center agents exist...')
  const agents: any[] = []
  for (const agentData of agentsData) {
    let agent = await prisma.user.findFirst({ where: { email: agentData.email } })
    if (!agent) {
      agent = await prisma.user.create({
        data: {
          id: `agent_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          email: agentData.email,
          password: await bcrypt.hash('agent123', 10),
          name: agentData.name,
          role: 'CALL_CENTER',
          isActive: true,
        }
      })
      console.log(`  ✅ Created agent: ${agentData.name}`)
    } else {
      console.log(`  ℹ️ Agent exists: ${agentData.name}`)
    }

    // Ensure agent session exists (for online status)
    let session = await prisma.agentSession.findUnique({ where: { userId: agent.id } })
    if (!session) {
      session = await prisma.agentSession.create({
        data: {
          userId: agent.id,
          lastSeen: new Date(),
          isOnline: true,
        }
      })
      console.log(`  ✅ Created session for: ${agentData.name}`)
    }
    agents.push(agent)
  }

  // Get existing sellers
  const sellers = await prisma.user.findMany({
    where: { role: 'SELLER' },
    select: { id: true, name: true }
  })

  if (sellers.length === 0) {
    console.log('❌ No sellers found. Creating test sellers first...')
    const testSellers = [
      { name: 'Hervé', email: 'herve@test.gaboncod.com' },
      { name: 'Chancelle', email: 'chancelle@test.gaboncod.com' },
      { name: 'Patrick', email: 'patrick@test.gaboncod.com' },
      { name: 'Laure', email: 'laure@test.gaboncod.com' },
    ]

    for (const sellerData of testSellers) {
      const seller = await prisma.user.create({
        data: {
          id: `seller_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          email: sellerData.email,
          password: await bcrypt.hash('seller123', 10),
          name: sellerData.name,
          role: 'SELLER',
          isActive: true,
        }
      })
      sellers.push({ id: seller.id, name: seller.name })
      console.log(`  ✅ Created seller: ${sellerData.name}`)
    }
  }

  console.log(`👤 Found ${sellers.length} sellers`)

  // Get products for sellers
  const products = await prisma.product.findMany({
    select: { id: true, name: true, sellerId: true, costPrice: true, sellPrice: true }
  })

  // Create products for sellers that don't have any
  if (products.length < 4) {
    console.log('📦 Creating products for sellers...')
    const defaultProducts = [
      { name: 'Blender Portable', sku: 'BLD-001', costPrice: 5000, sellPrice: 15000 },
      { name: 'Ceinture Minceur', sku: 'CMN-001', costPrice: 4000, sellPrice: 12000 },
      { name: 'Lampe Solaire', sku: 'LSP-001', costPrice: 3000, sellPrice: 8000 },
      { name: 'Fer à Lisser', sku: 'FLR-001', costPrice: 3500, sellPrice: 18000 },
      { name: 'Brosse Électrique', sku: 'BRU-001', costPrice: 2000, sellPrice: 10000 },
    ]

    for (const seller of sellers) {
      const productData = defaultProducts[Math.floor(Math.random() * defaultProducts.length)]
      const existingProduct = await prisma.product.findFirst({
        where: { sellerId: seller.id }
      })
      if (!existingProduct) {
        await prisma.product.create({
          data: {
            id: `prod_${seller.id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            sellerId: seller.id,
            name: productData.name,
            sku: productData.sku,
            costPrice: productData.costPrice,
            sellPrice: productData.sellPrice,
            isActive: true,
          }
        })
        console.log(`  ✅ Created product for ${seller.name}: ${productData.name}`)
      }
    }
  }

  // Refresh products after creating
  const allProducts = await prisma.product.findMany({
    select: { id: true, name: true, sellerId: true, costPrice: true, sellPrice: true }
  })

  // Create ~56 NEW orders distributed across sellers and assigned to agents
  const orderCount = 56
  console.log(`📋 Creating ${orderCount} NEW orders...`)

  const cities = ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem', 'Moanda']
  const codAmounts = [8000, 10000, 12000, 15000, 18000, 20000]

  let orderCounter = 0
  const today = new Date()

  for (let i = 0; i < orderCount; i++) {
    // Pick a seller
    const seller = sellers[i % sellers.length]

    // Pick a product for this seller
    const sellerProducts = allProducts.filter(p => p.sellerId === seller.id)
    const product = sellerProducts[Math.floor(Math.random() * sellerProducts.length)]

    if (!product) continue

    // Pick an agent (round-robin distribution)
    const agent = agents[i % agents.length]

    // Generate order data
    const city = cities[Math.floor(Math.random() * cities.length)]
    const codAmount = codAmounts[Math.floor(Math.random() * codAmounts.length)]
    const orderDate = new Date(today.getTime() - Math.floor(Math.random() * 3 * 24 * 60 * 60 * 1000)) // Last 3 days
    const quantity = Math.floor(Math.random() * 2) + 1 // 1 or 2 items

    // Create tracking number
    const trackingNumber = `GAB${Date.now().toString(36).substring(2, 8)}${i.toString().padStart(5, '0')}`

    // Create order
    const order = await prisma.order.create({
      data: {
        id: `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${i}`,
        trackingNumber,
        sellerId: seller.id,
        recipientName: getRandomName(),
        phone: getRandomPhone(),
        address: getRandomAddress(city),
        city: city,
        codAmount: codAmount * quantity,
        status: 'NEW', // All orders are NEW (pending confirmation)
        source: 'MANUAL',
        assignedAgentId: agent.id, // Assign to agent
        createdAt: orderDate,
      }
    })

    // Create order item(s)
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        quantity: quantity,
        unitPrice: product.sellPrice,
      }
    })

    // Randomly create bundles (same customer with 2+ items)
    if (Math.random() < 0.15 && i < orderCount - 1) {
      const bundleGroupId = `bundle_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      await prisma.order.update({
        where: { id: order.id },
        data: { bundleGroupId }
      })
    }

    orderCounter++

    if (orderCounter % 10 === 0) {
      console.log(`  📝 Created ${orderCounter}/${orderCount} orders...`)
    }
  }

  console.log(`  ✅ Created ${orderCounter} NEW orders`)

  // Add some scheduled callback orders (orders with future scheduledCallAt)
  console.log('📅 Adding scheduled callback orders...')
  for (let i = 0; i < 5; i++) {
    const seller = sellers[i % sellers.length]
    const sellerProducts = allProducts.filter(p => p.sellerId === seller.id)
    const product = sellerProducts[Math.floor(Math.random() * sellerProducts.length)]
    if (!product) continue
    const agent = agents[i % agents.length]

    const futureDate = new Date(today.getTime() + (i + 1) * 2 * 60 * 60 * 1000) // 2, 4, 6, 8, 10 hours ahead

    const order = await prisma.order.create({
      data: {
        id: `order_scheduled_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        trackingNumber: `GABS${Date.now().toString(36).substring(2, 8)}${i}`,
        sellerId: seller.id,
        recipientName: getRandomName(),
        phone: getRandomPhone(),
        address: getRandomAddress('Libreville'),
        city: 'Libreville',
        codAmount: 15000,
        status: 'NEW',
        source: 'MANUAL',
        assignedAgentId: agent.id,
        scheduledCallAt: futureDate, // Future time - won't show in queue yet
        createdAt: new Date(today.getTime() - 6 * 60 * 60 * 1000),
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
  }
  console.log(`  ✅ Created 5 scheduled callback orders (will appear later)`)

  // Add some past scheduled callback orders (should appear in queue)
  console.log('📅 Adding past scheduled callback orders (should appear in queue)...')
  for (let i = 0; i < 3; i++) {
    const seller = sellers[(i + 1) % sellers.length]
    const sellerProducts = allProducts.filter(p => p.sellerId === seller.id)
    const product = sellerProducts[Math.floor(Math.random() * sellerProducts.length)]
    if (!product) continue
    const agent = agents[i % agents.length]

    const pastDate = new Date(today.getTime() - (i + 1) * 30 * 60 * 1000) // 30, 60, 90 mins ago

    const order = await prisma.order.create({
      data: {
        id: `order_past_scheduled_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        trackingNumber: `GABP${Date.now().toString(36).substring(2, 8)}${i}`,
        sellerId: seller.id,
        recipientName: getRandomName(),
        phone: getRandomPhone(),
        address: getRandomAddress('Libreville'),
        city: 'Libreville',
        codAmount: 15000,
        status: 'NEW',
        source: 'MANUAL',
        assignedAgentId: agent.id,
        scheduledCallAt: pastDate, // Past time - should show in queue
        createdAt: new Date(today.getTime() - 2 * 60 * 60 * 1000),
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
  }
  console.log(`  ✅ Created 3 past scheduled callback orders (in queue now)`)

  console.log('\n📊 Summary:')
  console.log('====================')
  console.log(`Call Center Agents: ${agents.length}`)
  console.log(`Sellers: ${sellers.length}`)
  console.log(`Products: ${allProducts.length}`)
  console.log(`NEW Orders Created: ${orderCounter}`)
  console.log(`Scheduled Callback Orders (Future): 5`)
  console.log(`Scheduled Callback Orders (Past/In Queue): 3`)
  console.log('====================')
  console.log('\n🔑 Agent Login Credentials:')
  console.log('-------------------')
  for (const agent of agents) {
    console.log(`  - ${agent.email} (${agent.name}) - Password: agent123`)
  }
  console.log('-------------------')
}

function getRandomName() {
  const firstNames = ['Jean', 'Paul', 'Marie', 'François', 'Célestine', 'Marc', 'Sophie', 'André', 'Patrice', 'Aïcha', 'Christian', 'Brigitte', 'Luc', 'Emma', 'Nadia', 'Karl', 'Isabelle', 'Dieudonné', 'Blanche', 'Augustin']
  const lastNames = ['Moussa', 'Nguema', 'Bekale', 'Nze', 'Moubamba', 'Mboumba', 'Ondo', 'Eyene', 'Moundounga', 'Owono', 'Nkoghe', 'Mendame', 'Elonga', 'Edima', 'Nzeng', 'Mabika', 'Obame', 'Bikambi', 'Minko', 'Meye']

  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`
}

function getRandomPhone() {
  const prefixes = ['074', '062', '055', '043', '066']
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  const suffix = Math.floor(Math.random() * 1000000).toString().padStart(7, '0')
  return `+241${prefix}${suffix}`
}

function getRandomAddress(city: string) {
  const neighborhoods: Record<string, string[]> = {
    'Libreville': ['Akanda', 'PK5', 'Louis', 'Nombakélé', 'Owendo', 'Glass', 'Mont-Bouët', 'Sablier'],
    'Port-Gentil': ['Downtown', 'Zone Industrielle', 'Port', 'Mandji', 'Graland'],
    'Franceville': ['Centre', 'Quartier Sud', 'Alembe', 'Moulenda'],
    'Oyem': ['Centre ville', 'Quartier Est', 'Mangoussi'],
    'Moanda': ['Centre', 'Quartier Ouest', 'Mine'],
  }

  const areas = neighborhoods[city] || ['Centre']
  const area = areas[Math.floor(Math.random() * areas.length)]
  const houseNum = Math.floor(Math.random() * 200) + 1
  const streetTypes = ['Rue', 'Avenue', 'Boulevard', 'Allée']
  const streetType = streetTypes[Math.floor(Math.random() * streetTypes.length)]

  return `${area}, ${streetType} ${houseNum}`
}

main()
  .catch((e) => {
    console.error('Error seeding orders:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    console.log('\n✅ Database disconnected')
  })
