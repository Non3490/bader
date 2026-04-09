import { db } from '@/lib/db'
import {
  createImpersonationSession,
  setAdminSessionCookie,
  getAdminSession,
  clearAdminSession,
  type AdminSessionPayload
} from './admin-auth'
import { logImpersonationStart, logImpersonationEnd, AUDIT_ACTIONS } from './audit-logger'
import type { AdminRole } from './admin-auth'

/**
 * Impersonation Service
 *
 * SAFETY RULES (from task spec):
 * 1. Only Super Admin can impersonate — no other role, ever
 * 2. Log every impersonation session in audit log
 * 3. Visual indicator — red banner when impersonating
 * 4. Read-only by default — cannot make writes unless explicitly enabled
 * 5. Auto-expire — session ends after 30 minutes
 * 6. Cannot impersonate another Super Admin — prevent privilege loops
 * 7. Implementation: Store impersonatingUserId in JWT/session
 */

interface ImpersonationResult {
  success: boolean
  error?: string
  expiresAt?: Date
}

/**
 * Start an impersonation session
 *
 * @param adminId - The Super Admin starting the impersonation
 * @param targetUserId - The user to impersonate
 * @returns Result with success status and expiration time
 */
export async function startImpersonation(
  adminId: string,
  targetUserId: string
): Promise<ImpersonationResult> {
  // SAFETY RULE 1: Only Super Admin can impersonate
  const admin = await db.admin.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true
    }
  })

  if (!admin) {
    return { success: false, error: 'Admin not found' }
  }

  if (admin.role !== 'SUPER_ADMIN') {
    return {
      success: false,
      error: 'Only Super Admin can impersonate users'
    }
  }

  if (admin.status !== 'ACTIVE') {
    return { success: false, error: 'Admin account is not active' }
  }

  // Get target user
  const targetUser = await db.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true
    }
  })

  if (!targetUser) {
    return { success: false, error: 'Target user not found' }
  }

  if (!targetUser.isActive) {
    return { success: false, error: 'Cannot impersonate inactive user' }
  }

  // SAFETY RULE 6: Cannot impersonate a Super Admin (prevent privilege loops)
  // Note: User table doesn't have Super Admin role, but this is for future-proofing
  if (targetUser.role === 'SUPER_ADMIN' || targetUser.role === 'ADMIN') {
    return {
      success: false,
      error: 'Cannot impersonate admin accounts'
    }
  }

  // Check if there's already an active impersonation session
  const currentSession = await getAdminSession()
  if (currentSession?.impersonatingId) {
    return {
      success: false,
      error: 'Already impersonating a user. End current session first.'
    }
  }

  // Create impersonation session
  const { token, expiresAt } = await createImpersonationSession(admin, targetUser)

  // SAFETY RULE 2: Log every impersonation session
  await logImpersonationStart(
    admin.id,
    admin.name,
    admin.role as AdminRole,
    targetUser.id,
    targetUser.name
  )

  // Set the impersonation cookie
  await setAdminSessionCookie(token)

  return {
    success: true,
    expiresAt
  }
}

/**
 * End an impersonation session
 *
 * Restores the original admin session
 */
export async function endImpersonation(): Promise<ImpersonationResult> {
  const currentSession = await getAdminSession()

  if (!currentSession) {
    return { success: false, error: 'No active session' }
  }

  if (!currentSession.impersonatingId) {
    return { success: false, error: 'Not currently impersonating' }
  }

  // Log the end of impersonation
  await logImpersonationEnd(
    currentSession.adminId,
    currentSession.name,
    currentSession.role as AdminRole,
    currentSession.impersonatingId
  )

  // Clear the impersonation session
  await clearAdminSession()

  return { success: true }
}

/**
 * Check if the current session is an impersonation session
 */
export async function isImpersonating(): Promise<boolean> {
  const session = await getAdminSession()
  return session?.impersonatingId !== undefined
}

/**
 * Get the impersonation info for the current session
 */
export async function getImpersonationInfo(): Promise<{
  isImpersonating: boolean
  targetUser?: {
    id: string
    name: string
    role: string
  }
  admin: {
    id: string
    name: string
    email: string
    role: string
  }
} | null> {
  const session = await getAdminSession()

  if (!session) {
    return null
  }

  if (!session.impersonatingId) {
    return {
      isImpersonating: false,
      admin: {
        id: session.adminId,
        name: session.name,
        email: session.email,
        role: session.role
      }
    }
  }

  return {
    isImpersonating: true,
    targetUser: {
      id: session.impersonatingId,
      name: session.impersonatingName || 'Unknown',
      role: session.impersonatingRole || 'Unknown'
    },
    admin: {
      id: session.adminId,
      name: session.name,
      email: session.email,
      role: session.role
    }
  }
}

/**
 * Get the effective user ID for data access
 *
 * During impersonation, returns the target user ID for reads
 * For audit logs and writes, should use the actual admin ID
 */
export function getEffectiveUserId(session: AdminSessionPayload): string {
  // SAFETY RULE 7: For data scoping, use impersonating user ID
  return session.impersonatingId || session.adminId
}

/**
 * Check if write operations are allowed
 *
 * SAFETY RULE 4: Read-only by default
 */
export function canWrite(session: AdminSessionPayload): boolean {
  // Currently, impersonation is always read-only
  // This can be extended later with explicit write mode
  return !session.impersonatingId
}

/**
 * Check if the impersonation session is about to expire
 *
 * @returns minutes remaining, or null if not impersonating
 */
export async function getImpersonationTimeRemaining(): Promise<number | null> {
  const session = await getAdminSession()

  if (!session?.impersonatingId) {
    return null
  }

  // JWT expiration is checked automatically, but we can estimate
  // The session was created with 30 minute expiration
  // We'll need to store the creation time to calculate this accurately
  return null // Will be implemented with session metadata
}

/**
 * Validate that an action can be performed during impersonation
 *
 * @param action - The action being performed ('read' | 'write' | 'delete')
 * @returns Whether the action is allowed
 */
export function validateImpersonationAction(
  session: AdminSessionPayload,
  action: 'read' | 'write' | 'delete'
): { allowed: boolean; reason?: string } {
  if (!session.impersonatingId) {
    // Not impersonating, all actions allowed
    return { allowed: true }
  }

  // SAFETY RULE 4: Read-only by default
  if (action !== 'read') {
    return {
      allowed: false,
      reason: 'Cannot perform write operations while impersonating. End impersonation session first.'
    }
  }

  return { allowed: true }
}

/**
 * Get a list of users that can be impersonated
 *
 * Filters out admins and inactive users
 */
export async function getImpersonateableUsers(params: {
  search?: string
  role?: string
  limit?: number
  offset?: number
}) {
  const where: Record<string, unknown> = {
    isActive: true,
    // Exclude admin roles from impersonation
    role: {
      notIn: ['ADMIN', 'SUPER_ADMIN']
    }
  }

  if (params.search) {
    where.OR = [
      { name: { contains: params.search } },
      { email: { contains: params.search } }
    ]
  }

  if (params.role) {
    where.role = params.role
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit || 50,
      skip: params.offset || 0
    }),
    db.user.count({ where })
  ])

  return { users, total }
}

/**
 * Get recent impersonation activity
 */
export async function getRecentImpersonations(limit = 20) {
  return db.auditLog.findMany({
    where: {
      action: {
        in: [AUDIT_ACTIONS.IMPERSONATION_STARTED, AUDIT_ACTIONS.IMPERSONATION_ENDED]
      }
    },
    include: {
      impersonatingAs: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  })
}
