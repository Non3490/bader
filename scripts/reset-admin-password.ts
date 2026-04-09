import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  const password = await bcrypt.hash('admin123', 10)

  const admin = await db.user.update({
    where: { email: 'admin@gaboncod.com' },
    data: { password }
  })

  console.log('✅ Admin password reset to: admin123')
  console.log('Email:', admin.email)

  await db.$disconnect()
}

main().catch(console.error)
