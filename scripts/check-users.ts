import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  })

  console.log('\n=== USERS IN DATABASE ===')
  console.log(`Total users: ${users.length}\n`)

  for (const user of users) {
    console.log(`ID: ${user.id}`)
    console.log(`Email: ${user.email}`)
    console.log(`Name: ${user.name}`)
    console.log(`Role: ${user.role}`)
    console.log(`Active: ${user.isActive}`)
    console.log(`Created: ${user.createdAt}`)
    console.log('---')
  }

  await db.$disconnect()
}

main().catch(console.error)
