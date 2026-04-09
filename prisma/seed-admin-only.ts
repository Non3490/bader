/**
 * Admin-Only Seed Script for Fresh Production Deploy
 * Creates only the SUPER_ADMIN account — no sellers, orders, or sample data.
 *
 * Run: npx tsx prisma/seed-admin-only.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const ADMIN_EMAIL = 'admin@gaboncod.com'
const ADMIN_PASSWORD = 'Admin@2026!' // Strong password for production

async function main() {
  console.log('🔐 Creating admin-only account...')

  // Check if admin already exists
  const existing = await db.admin.findUnique({ where: { email: ADMIN_EMAIL } })
  if (existing) {
    console.log('⚠️  Admin already exists, skipping creation.')
    console.log(`   Email: ${ADMIN_EMAIL}`)
    return
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12)

  const admin = await db.admin.create({
    data: {
      email: ADMIN_EMAIL,
      password: hashedPassword,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE'
    }
  })

  console.log('\n✅ Admin account created successfully!')
  console.log('═══════════════════════════════════════')
  console.log(`Email:    ${admin.email}`)
  console.log(`Password: ${ADMIN_PASSWORD}`)
  console.log(`Role:     ${admin.role}`)
  console.log('═══════════════════════════════════════')
  console.log('\n⚠️  IMPORTANT: Change this password after first login!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
