const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateAgentSessions() {
  const now = new Date();

  console.log('Updating agent sessions to make them online...');

  // Update all CALL_CENTER agents' lastSeen to now
  const result = await prisma.agentSession.updateMany({
    where: {
      user: {
        role: 'CALL_CENTER'
      }
    },
    data: {
      lastSeen: now,
      isOnline: true
    }
  });

  console.log(`Updated ${result.count} agent session(s)`);
  console.log('Agents are now considered ONLINE!');

  await prisma.$disconnect();
  process.exit(0);
}

updateAgentSessions().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
