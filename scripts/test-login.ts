import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  // Test admin login
  const email = 'admin@gaboncod.com'
  const password = 'admin123'

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() }
  })

  if (!user) {
    console.log('User not found')
    return
  }

  console.log('\n=== LOGIN TEST ===')
  console.log(`Email: ${email}`)
  console.log(`Password: ${password}`)
  console.log(`User found: ${user.name} (${user.role})`)
  console.log(`User active: ${user.isActive}`)

  // Test password verification
  const isValid = await bcrypt.compare(password, user.password)
  console.log(`Password valid: ${isValid}`)

  if (!isValid) {
    console.log('\n❌ PASSWORD MISMATCH!')
    console.log('This could be due to:')
    console.log('- Different bcrypt rounds (seed uses 10, verify uses 12)')
    console.log('- Password was changed in database')

    // Let's try to hash with same rounds as seed
    const testHash = await bcrypt.hash(password, 10)
    console.log(`\nTest hash (10 rounds): ${testHash.substring(0, 30)}...`)
    console.log(`Stored hash:           ${user.password.substring(0, 30)}...`)

    // Test re-hashing with current rounds
    const newHash = await bcrypt.hash(password, 12)
    console.log(`New hash (12 rounds):  ${newHash.substring(0, 30)}...`)

    // Update password with new hash
    await db.user.update({
      where: { id: user.id },
      data: { password: newHash }
    })
    console.log('\n✅ Password re-hashed and updated in database')

    // Test again
    const isValidAfter = await bcrypt.compare(password, newHash)
    console.log(`Password valid after update: ${isValidAfter}`)
  } else {
    console.log('\n✅ LOGIN SHOULD WORK!')
  }

  await db.$disconnect()
}

main().catch(console.error)
