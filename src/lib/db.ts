import { PrismaClient } from '@prisma/client'
import { auditMiddleware } from './prisma-middleware'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// Register audit middleware for automatic logging of mutations
// TODO: $use middleware not available in current Prisma version
// db.$use(auditMiddleware)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
