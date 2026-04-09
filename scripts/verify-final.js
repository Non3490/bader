const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60000);

  const agents = await prisma.user.findMany({
    where: {
      role: 'CALL_CENTER',
      isActive: true,
      agentSession: {
        lastSeen: { gte: oneMinuteAgo }
      }
    },
    select: { id: true, email: true, name: true, agentSession: { select: { lastSeen: true } } }
  });

  console.log('=== ONLINE AGENTS (checked again) ===');
  console.log('Now:', now.toISOString());
  console.log('OneMinuteAgo:', oneMinuteAgo.toISOString());
  console.log('Count:', agents.length);

  if (agents.length > 0) {
    agents.forEach(a => {
      const lastSeen = new Date(a.agentSession.lastSeen);
      console.log(`  ${a.email} - ${lastSeen.toISOString()}`);
    });
  }

  // Check NEW orders
  const newOrders = await prisma.order.findMany({
    where: { status: 'NEW' },
    select: { id: true, trackingNumber: true, assignedAgentId: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  console.log('');
  console.log('=== RECENT NEW ORDERS ===');
  newOrders.forEach((o, i) => {
    console.log(`${i+1}. ${o.trackingNumber} - Assigned: ${o.assignedAgentId}`);
  });

  await prisma.$disconnect();
  process.exit(0);
}

verify().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
