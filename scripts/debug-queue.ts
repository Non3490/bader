import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugQueue() {
  console.log('\n=== DEBUG QUEUE ===\n')

  const now = new Date()

  // Check NEW orders
  const newOrders = await prisma.order.findMany({
    where: {
      status: 'NEW',
      OR: [
        { scheduledCallAt: null },
        { scheduledCallAt: { lte: now } }
      ]
    }
  })

  console.log(`Total NEW orders: ${newOrders.length}`)

  // Check by seller
  const bySeller = await prisma.order.groupBy({
    by: ['sellerId'],
    where: { status: 'NEW' },
    _count: { _all: true }
  })

  console.log('\nOrders by seller:')
  for (const group of bySeller) {
    console.log(`  Seller ${group.sellerId}: ${group._count._all} orders`)
  }

  // Check assigned vs unassigned
  const assigned = await prisma.order.count({
    where: { status: 'NEW', assignedAgentId: { not: null } }
  })

  const unassigned = await prisma.order.count({
    where: { status: 'NEW', assignedAgentId: null }
  })

  console.log(`\nAssigned: ${assigned}`)
  console.log(`Unassigned: ${unassigned}`)

  // Check agent sessions
  const agents = await prisma.user.findMany({
    where: { role: 'CALL_CENTER', isActive: true },
    include: { agentSession: true }
  })

  console.log('\nCall Center Agents:')
  const sixtySecondsAgo = new Date(now.getTime() - 60000)

  for (const agent of agents) {
    const isOnline = agent.agentSession?.lastSeen
      ? agent.agentSession.lastSeen >= sixtySecondsAgo
      : false

    console.log(`  ${agent.name} (${agent.email})`)
    console.log(`    isOnline: ${isOnline}`)
    console.log(`    lastSeen: ${agent.agentSession?.lastSeen}`)
  }

  // Check what agent-assign would return
  console.log('\nTesting agent-assign query...')

  const whereClause: any = {
    status: 'NEW',
    OR: [
      { scheduledCallAt: null },
      { scheduledCallAt: { lte: now } }
    ]
  }

  const orders = await prisma.order.findMany({
    where: whereClause,
    select: {
      id: true,
      phone: true,
      createdAt: true,
      scheduledCallAt: true,
      seller: { select: { id: true, name: true } },
      items: {
        select: {
          productId: true,
          product: { select: { id: true, name: true, description: true } }
        }
      }
    }
  })

  console.log(`Agent-assign would find: ${orders.length} orders`)

  await prisma.$disconnect()
}

debugQueue().catch(console.error)
