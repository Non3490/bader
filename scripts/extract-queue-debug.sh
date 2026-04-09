#!/bin/bash

echo "=== EXTRACT QUEUE DEBUG ==="
echo ""

# 1. Check NEW orders directly from database
echo "1. NEW Orders from DB:"
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const now = new Date();
  const count = await prisma.order.count({ where: { status: 'NEW' } });
  console.log(\`   Total NEW orders: \${count}\`);
  await prisma.\$disconnect();
})();
"

echo ""

# 2. Test queue API (without auth)
echo "2. Queue API (no auth):"
curl -s http://localhost:3000/api/orders/queue | head -100

echo ""

# 3. Test auth/me endpoint
echo "3. Auth/me endpoint:"
curl -s http://localhost:3000/api/auth/me | head -100

echo ""

# 4. Check agent sessions
echo "4. Agent Sessions:"
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const now = new Date();
  const agents = await prisma.user.findMany({
    where: { role: 'CALL_CENTER' },
    include: { agentSession: true }
  });
  const sixtySecAgo = new Date(now.getTime() - 60000);
  agents.forEach(a => {
    const isOnline = a.agentSession?.lastSeen && a.agentSession.lastSeen >= sixtySecAgo;
    console.log(\`   \${a.name}: isOnline=\${isOnline}, lastSeen=\${a.agentSession?.lastSeen}\`);
  });
  await prisma.\$disconnect();
})();
"

echo ""

echo "=== DONE ==="
