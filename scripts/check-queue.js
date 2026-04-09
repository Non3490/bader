const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkQueue() {
  const now = new Date();

  // Check NEW orders (exactly as the queue API does)
  const newOrders = await prisma.order.findMany({
    where: {
      status: 'NEW',
      OR: [
        { scheduledCallAt: null },
        { scheduledCallAt: { lte: now } }
      ]
    },
    select: {
      id: true,
      trackingNumber: true,
      status: true,
      scheduledCallAt: true,
      sellerId: true,
      assignedAgentId: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  // Check all orders with status NEW
  const allNewOrders = await prisma.order.count({
    where: { status: 'NEW' }
  });

  // Check agents
  const agents = await prisma.user.findMany({
    where: { role: 'CALL_CENTER' },
    select: { id: true, name: true, isActive: true }
  });

  // Check agent sessions
  const sessions = await prisma.agentSession.findMany({
    select: { userId: true, lastSeen: true, isOnline: true }
  });

  console.log('=== CALL CENTER QUEUE CHECK ===');
  console.log('NEW orders meeting queue criteria:', newOrders.length);
  console.log('Total NEW orders:', allNewOrders);
  console.log('');
  console.log('=== AGENTS ===');
  console.log('Total agents:', agents.length);
  agents.forEach(a => console.log('  - ' + a.name + ' (ID: ' + a.id + ', Active: ' + a.isActive + ')'));
  console.log('');
  console.log('=== AGENT SESSIONS ===');
  sessions.forEach(s => {
    const lastSeen = new Date(s.lastSeen);
    const minutesAgo = Math.floor((now - lastSeen) / 60000);
    console.log('  - UserID: ' + s.userId + ', Online: ' + s.isOnline + ', Last seen: ' + minutesAgo + ' mins ago');
  });

  // Check specific order details
  if (newOrders.length > 0) {
    console.log('');
    console.log('=== FIRST ORDER IN QUEUE ===');
    const firstOrder = newOrders[0];
    console.log('Tracking:', firstOrder.trackingNumber);
    console.log('Status:', firstOrder.status);
    console.log('Scheduled Call:', firstOrder.scheduledCallAt);
    console.log('Assigned Agent:', firstOrder.assignedAgentId);
    console.log('Seller ID:', firstOrder.sellerId);
  }

  await prisma.$disconnect();
  process.exit(0);
}

checkQueue().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
