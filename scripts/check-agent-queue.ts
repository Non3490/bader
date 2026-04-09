import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAgentQueue() {
  console.log('\n=== AGENT & QUEUE STATUS CHECK ===\n')

  const now = new Date()
  const onlineThreshold = new Date(now.getTime() - 60000) // 60 seconds ago

  // 1. Check all Call Center agents
  console.log('📞 CALL CENTER AGENTS:')
  const agents = await prisma.user.findMany({
    where: { role: 'CALL_CENTER' },
    include: { agentSession: true },
    orderBy: { name: 'asc' }
  })

  for (const agent of agents) {
    const isOnline = agent.agentSession?.lastSeen
      ? (now.getTime() - new Date(agent.agentSession.lastSeen).getTime()) < 60000
      : false

    const pendingLeads = await prisma.order.count({
      where: {
        assignedAgentId: agent.id,
        status: 'NEW'
      }
    })

    const todayConfirmed = await prisma.order.count({
      where: {
        assignedAgentId: agent.id,
        history: {
          some: {
            changedById: agent.id,
            newStatus: 'CONFIRMED',
            createdAt: { gte: new Date(now.setHours(0, 0, 0, 0)) }
          }
        }
      }
    })

    const statusIcon = isOnline ? '🟢' : '🔴'
    const lastSeen = agent.agentSession?.lastSeen
      ? `Last seen: ${new Date(agent.agentSession.lastSeen).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Libreville' })}`
      : 'Never seen'

    console.log(`  ${statusIcon} ${agent.name} (${agent.email})`)
    console.log(`     Status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`)
    console.log(`     ${lastSeen}`)
    console.log(`     Pending leads: ${pendingLeads}`)
    console.log(`     Confirmed today: ${todayConfirmed}`)
    console.log()
  }

  // 2. Check Queue Summary
  console.log('📋 QUEUE SUMMARY:')

  const totalNew = await prisma.order.count({ where: { status: 'NEW' } })
  const unassigned = await prisma.order.count({
    where: { status: 'NEW', assignedAgentId: null }
  })

  // Orders with scheduled callback in future (hidden from queue)
  const scheduledFuture = await prisma.order.count({
    where: {
      status: 'NEW',
      scheduledCallAt: { gt: now }
    }
  })

  // Orders with scheduled callback in past (visible in queue)
  const scheduledPast = await prisma.order.count({
    where: {
      status: 'NEW',
      scheduledCallAt: { lte: now },
      scheduledCallAt: { not: null }
    }
  })

  console.log(`  Total NEW orders: ${totalNew}`)
  console.log(`  Unassigned: ${unassigned}`)
  console.log(`  Scheduled (future - hidden): ${scheduledFuture}`)
  console.log(`  Scheduled (past - visible): ${scheduledPast}`)
  console.log(`  Available in queue: ${totalNew - scheduledFuture}`)
  console.log()

  // 3. Orders by Agent
  console.log('📊 ORDERS PER AGENT:')
  const ordersByAgent = await prisma.order.groupBy({
    by: ['assignedAgentId'],
    where: { status: 'NEW' },
    _count: { _all: true }
  })

  for (const group of ordersByAgent) {
    const agent = agents.find(a => a.id === group.assignedAgentId)
    const name = agent ? agent.name : 'Unknown'
    const isOnline = agent?.agentSession?.lastSeen
      ? (now.getTime() - new Date(agent.agentSession.lastSeen).getTime()) < 60000
      : false
    const icon = isOnline ? '🟢' : '🔴'
    console.log(`  ${icon} ${name}: ${group._count._all} orders`)
  }

  if (ordersByAgent.length === 0) {
    console.log('  No orders assigned to agents')
  }
  console.log()

  // 4. Recent Orders in Queue (top 10)
  console.log('📝 RECENT ORDERS IN QUEUE (top 10):')
  const recentOrders = await prisma.order.findMany({
    where: {
      status: 'NEW',
      OR: [
        { scheduledCallAt: null },
        { scheduledCallAt: { lte: now } }
      ]
    },
    include: {
      seller: { select: { name: true } },
      assignedAgent: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  if (recentOrders.length === 0) {
    console.log('  ⚠️ No orders in queue!')
  } else {
    for (const order of recentOrders) {
      const agentName = order.assignedAgent?.name || 'Unassigned'
      const scheduled = order.scheduledCallAt
        ? `📅 ${new Date(order.scheduledCallAt).toLocaleString('fr-FR', { timeZone: 'Africa/Libreville' })}`
        : ''
      console.log(`  ${order.trackingNumber} | ${order.recipientName} | ${order.phone}`)
      console.log(`     Product: ${order.codAmount.toLocaleString()} XAF | Agent: ${agentName} ${scheduled}`)
      console.log(`     Seller: ${order.seller.name}`)
    }
  }
  console.log()

  // 5. Blacklisted Customers
  const blacklistedCount = await prisma.blacklist.count({
    where: { isActive: true }
  })
  console.log('🚫 BLACKLISTED CUSTOMERS:')
  console.log(`  Active blacklist entries: ${blacklistedCount}`)
  console.log()

  await prisma.$disconnect()
}

checkAgentQueue().catch(console.error)
