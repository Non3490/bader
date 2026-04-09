import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  const deliveryUsers = await db.user.findMany({
    where: { role: 'DELIVERY', isActive: true },
    select: { id: true, name: true, phone: true }
  })

  for (const du of deliveryUsers) {
    if (!du.phone) { console.log('SKIP (no phone):', du.name); continue }
    const existing = await db.driver.findUnique({ where: { phone: du.phone } })
    if (!existing) {
      const defaultPin = du.phone.replace(/\D/g, '').slice(-4) || '1234'
      const hashed = await hash(defaultPin, 12)
      await db.driver.create({
        data: { name: du.name ?? 'Agent', phone: du.phone, pin: hashed, status: 'OFFLINE', isActive: true }
      })
      console.log(`CREATED | ${du.name} | ${du.phone} | PIN: ${defaultPin}`)
    } else {
      console.log(`EXISTS  | ${existing.name} | ${existing.phone}`)
    }
  }
}

main().finally(() => db.$disconnect())
