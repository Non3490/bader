const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // Get the Agent 1 account that has 50 orders
  const agentWithManyOrders = await prisma.user.findFirst({
    where: {
      email: 'agent1@gaboncod.com'
    },
    select: { id: true, email: true, name: true, role: true }
  });

  if (!agentWithManyOrders) {
    console.log('ERROR: Agent 1 account not found');
    process.exit(1);
  }

  console.log('Found Agent 1 with many orders:');
  console.log('  ID:', agentWithManyOrders.id);
  console.log('  Email:', agentWithManyOrders.email);
  console.log('  Name:', agentWithManyOrders.name);

  // Get orders assigned to the wrong Agent 1 ID
  const wrongAgent1Id = 'agent_1773320804078_swlt20';
  const ordersToMove = await prisma.order.findMany({
    where: {
      status: 'NEW',
      assignedAgentId: wrongAgent1Id
    },
    select: { id: true }
  });

  console.log(`Found ${ordersToMove.length} orders assigned to wrong Agent 1 ID`);

  if (ordersToMove.length > 0) {
    // Update orders to the correct Agent 1
    const result = await prisma.order.updateMany({
      where: {
        id: { in: ordersToMove.map(o => o.id) }
      },
      data: {
        assignedAgentId: agentWithManyOrders.id
      }
    });

    console.log(`Moved ${result.count} orders to correct Agent 1 (${agentWithManyOrders.id})`);
  } else {
    console.log('No orders to move');
  }

  await prisma.$disconnect();
})();
