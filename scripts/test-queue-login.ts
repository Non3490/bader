import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { SignJWT } from 'jose'

const prisma = new PrismaClient()

async function testQueueAccess() {
  console.log('\n=== TEST QUEUE ACCESS ===\n')

  const SECRET_KEY = process.env.JWT_SECRET || 'gabon-cod-platform-secret-key-2024'
  const secret = new TextEncoder().encode(SECRET_KEY)

  // 1. Get agent1 user
  const agent1 = await prisma.user.findUnique({
    where: { email: 'agent1@gaboncod.com' }
  })

  if (!agent1) {
    console.log('ERROR: agent1 not found')
    return
  }

  console.log(`Found agent1: ${agent1.name} (${agent1.role})`)

  // 2. Create JWT token for agent1
  const token = await new SignJWT({ userId: agent1.id, role: agent1.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)

  console.log(`Created token (first 50 chars): ${token.substring(0, 50)}...`)

  // 3. Test with the token via API call
  const queueResponse = await fetch('http://localhost:3000/api/orders/queue', {
    headers: {
      'Cookie': `session=${token}`,
      'Content-Type': 'application/json'
    }
  })

  const queueStatus = queueResponse.status
  const queueData = await queueResponse.json()

  console.log(`Queue API Status: ${queueStatus}`)
  console.log(`Queue API Response:`, queueData)

  // 4. Test getPriorityQueue directly
  console.log('\n=== Testing getPriorityQueue ===\n')
  const { getPriorityQueue } = await import('./src/lib/agent-assign.ts')

  try {
    const scoredQueue = await getPriorityQueue.getPriorityQueue(null)
    console.log(`getPriorityQueue returned: ${scoredQueue.length} orders`)

    if (scoredQueue.length > 0) {
      console.log('First few orders:')
      scoredQueue.slice(0, 3).forEach((sq, i) => {
        console.log(`  ${i+1}. Order ${sq.orderId} - Score: ${sq.score}, isBlacklisted: ${sq.isBlacklisted}, agentId: ${sq.agentId}`)
      })
    }
  } catch (error) {
    console.error('getPriorityQueue error:', error)
  }

  await prisma.$disconnect()
}

testQueueAccess().catch(console.error)
