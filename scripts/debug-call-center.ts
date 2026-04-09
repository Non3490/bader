/**
 * Debug Script for Call Center Module - Part 1
 *
 * Run with: npx tsx scripts/debug-call-center.ts
 *
 * This script runs the debug procedures from CALL-CENTER-PART1.md
 */

import { db } from '../src/lib/db'

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// ============================================================
// DEBUG 1 — Orders Not Appearing in Queue
// ============================================================
async function debug1_OrdersNotAppearing() {
  log('cyan', '\n=== DEBUG 1: Orders Not Appearing in Queue ===\n')

  // 1. Check order status and schedule
  log('yellow', '1. Checking NEW orders with scheduledCallAt...')
  const newOrders = await db.order.findMany({
    where: { status: 'NEW' },
    take: 10,
    select: {
      id: true,
      trackingNumber: true,
      status: true,
      scheduledCallAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (newOrders.length === 0) {
    log('gray', '  ⚠ No NEW orders found in database')
  } else {
    log('green', `  Found ${newOrders.length} NEW orders:`)
    for (const order of newOrders) {
      const hasFutureSchedule = order.scheduledCallAt && new Date(order.scheduledCallAt) > new Date()
      log('blue', `    ${order.trackingNumber}`)
      log('gray', `      Status: ${order.status}`)
      log('gray', `      Created: ${order.createdAt}`)
      if (order.scheduledCallAt) {
        if (hasFutureSchedule) {
          log('red', `      ⚠ ScheduledAt: ${order.scheduledCallAt} (FUTURE - order hidden!)`)
        } else {
          log('green', `      ScheduledAt: ${order.scheduledCallAt} (past - order visible)`)
        }
      } else {
        log('green', `      ScheduledAt: null (order visible)`)
      }
    }
  }

  // 2. Check CALL_CENTER users
  log('yellow', '\n2. Checking CALL_CENTER users...')
  const callCenterAgents = await db.user.findMany({
    where: { role: 'CALL_CENTER' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  })

  if (callCenterAgents.length === 0) {
    log('red', '  ⚠ No CALL_CENTER users found!')
    log('gray', '  Create a CALL_CENTER user to test:')
    log('gray', '  UPDATE "User" SET role = "CALL_CENTER" WHERE email = "your-email@example.com";')
  } else {
    log('green', `  Found ${callCenterAgents.length} CALL_CENTER agent(s):`)
    for (const agent of callCenterAgents) {
      log('blue', `    ${agent.name} (${agent.email})`)
      log('gray', `      Role: ${agent.role}`)
      log('gray', `      Active: ${agent.isActive ? 'Yes' : 'No'}`)
    }
  }

  // 3. Check orders API would return
  log('yellow', '\n3. Checking what orders API would return for CALL_CENTER...')
  const { scopeByRole } = await import('../src/lib/auth-guard')

  // Simulate for each CALL_CENTER agent
  for (const agent of callCenterAgents.slice(0, 2)) {
    log('blue', `\n  Agent: ${agent.name}`)
    const where = scopeByRole(agent.id, agent.role, agent.parentSellerId)
    const orderCount = await db.order.count({
      where: { ...where, status: 'NEW' },
    })
    log('green', `    Would return ${orderCount} NEW orders`)
    log('gray', `    Scope: ${JSON.stringify(where)}`)
  }
}

// ============================================================
// DEBUG 2 — Agent Not Showing Online
// ============================================================
async function debug2_AgentNotShowingOnline() {
  log('cyan', '\n=== DEBUG 2: Agent Not Showing Online ===\n')

  // 1. Check AgentSession records
  log('yellow', '1. Checking AgentSession records...')
  const agentsWithSessions = await db.user.findMany({
    where: { role: 'CALL_CENTER' },
    include: { agentSession: true },
  })

  if (agentsWithSessions.length === 0) {
    log('red', '  ⚠ No CALL_CENTER agents found')
    return
  }

  log('green', `  Found ${agentsWithSessions.length} agent(s):`)
  const now = new Date()

  for (const agent of agentsWithSessions) {
    log('blue', `\n  Agent: ${agent.name}`)

    if (!agent.agentSession) {
      log('red', '    ⚠ No AgentSession record!')
      log('gray', '    Fix: Agent needs to open call-center page to create session')
      continue
    }

    const lastSeen = new Date(agent.agentSession.lastSeen)
    const secondsSinceLastSeen = Math.floor((now.getTime() - lastSeen.getTime()) / 1000)
    const isOnline = secondsSinceLastSeen < 60

    log('gray', `    isOnline: ${agent.agentSession.isOnline}`)
    log('gray', `    lastSeen: ${agent.agentSession.lastSeen}`)
    log('gray', `    secondsSinceLastSeen: ${secondsSinceLastSeen}s`)
    log('gray', `    currentWorkload: ${agent.agentSession.currentWorkload}`)

    if (agent.agentSession.isOnline !== isOnline) {
      log('red', `    ⚠ Database isOnline(${agent.agentSession.isOnline}) ≠ calculated(${isOnline})`)
      log('gray', '    Fix: Run cleanup job at /api/agents/cleanup')
    } else {
      log('green', `    ✅ isOnline status is correct`)
    }
  }

  // 2. Check if cleanup would work
  log('yellow', '\n2. Checking cleanup job logic...')
  const cutoff = new Date(now.getTime() - 60000)
  const agentsToMarkOffline = await db.agentSession.findMany({
    where: {
      isOnline: true,
      lastSeen: { lt: cutoff },
    },
    include: { user: { select: { name: true } } },
  })

  if (agentsToMarkOffline.length > 0) {
    log('yellow', `  ${agentsToMarkOffline.length} agent(s) would be marked offline:`)
    for (const session of agentsToMarkOffline) {
      log('gray', `    - ${session.user?.name} (lastSeen: ${session.lastSeen})`)
    }
  } else {
    log('green', `  ✅ All online agents are within 60s heartbeat window`)
  }
}

// ============================================================
// Debug 3 — Priority Score Calculation
// ============================================================
async function debug3_PriorityScores() {
  log('cyan', '\n=== DEBUG 3: Priority Score Calculation ===\n')

  const orders = await db.order.findMany({
    where: { status: 'NEW' },
    take: 5,
    select: {
      id: true,
      trackingNumber: true,
      status: true,
      createdAt: true,
      phone: true,
      items: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const { calculatePriorityScore } = await import('../src/lib/priority-score')

  log('yellow', 'Calculating priority scores for NEW orders...\n')

  for (const order of orders) {
    const score = calculatePriorityScore({
      ...order,
      itemCount: order.items?.length || 1,
      isBlacklisted: false,
    })
    const ageMinutes = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)
    log('blue', `  ${order.trackingNumber}`)
    log('gray', `    Score: ${score}`)
    log('gray', `    Age: ${ageMinutes} minutes`)
    log('gray', `    Items: ${order.items?.length || 1}`)
  }
}

// ============================================================
// Main
// ============================================================
async function main() {
  const args = process.argv.slice(2)
  const debug = args[0]

  log('magenta', '\n╔════════════════════════════════════════════════╗')
  log('magenta', '║   Call Center Module - Debug Script                ║')
  log('magenta', '╚════════════════════════════════════════════════╝')

  if (!debug || debug === 'all') {
    // Run all debug procedures
    await debug1_OrdersNotAppearing()
    await debug2_AgentNotShowingOnline()
    await debug3_PriorityScores()
  } else if (debug === '1') {
    await debug1_OrdersNotAppearing()
  } else if (debug === '2') {
    await debug2_AgentNotShowingOnline()
  } else if (debug === '3') {
    await debug3_PriorityScores()
  } else {
    log('gray', '\nUsage:')
    log('gray', '  npx tsx scripts/debug-call-center.ts [debug_number]')
    log('gray', '\nOptions:')
    log('gray', '  all  - Run all debug procedures (default)')
    log('gray', '  1    - Debug 1: Orders Not Appearing in Queue')
    log('gray', '  2    - Debug 2: Agent Not Showing Online')
    log('gray', '  3    - Debug 3: Priority Score Calculation')
  }
}

main().catch((error) => {
  log('red', '\n❌ Debug script failed:')
  console.error(error)
  process.exit(1)
})
