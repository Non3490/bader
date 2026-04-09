import { headers } from 'next/headers'
import { getSession } from './auth'
import { setAuditContext, clearAuditContext } from './prisma-middleware'

export async function initAuditContext() {
  const headersList = await headers()
  const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || headersList.get('cf-connecting-ip') || undefined
  try {
    const user = await getSession()
    setAuditContext({ userId: user?.id, userName: user?.name, userRole: user?.role, ipAddress })
  } catch {
    setAuditContext({ userId: 'ANONYMOUS', userName: 'Anonymous', userRole: 'ANONYMOUS', ipAddress })
  }
}

export async function cleanupAuditContext() {
  clearAuditContext()
}

export async function withAuditContext<T>(fn: () => Promise<T>): Promise<T> {
  await initAuditContext()
  try { return await fn() } finally { cleanupAuditContext() }
}
