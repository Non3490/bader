import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { hash, compare } from 'bcryptjs'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production')
}
const SECRET_KEY = process.env.JWT_SECRET || 'gabon-cod-platform-secret-key-2024'

if (!process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET not set, using default key. Please set in production!')
}

// Admin Role Types
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER'
export type AdminStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED'

// ROLE_PERMISSIONS - exact implementation from task spec
export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ['*'], // all permissions
  ADMIN: [
    'orders:view_all',
    'orders:create',
    'orders:edit',
    'orders:status_change',
    'staff:manage',
    'customers:manage',
    'notifications:configure',
    'reports:view_all',
    'data:export',
    'audit:view',
    'stock:manage_all',
    'passwords:reset_staff'
  ],
  MANAGER: [
    'orders:view_own_team',
    'orders:create',
    'orders:edit_own_team',
    'customers:view',
    'reports:view_own_team',
    'stock:manage_assigned'
  ]
} as const

export type Permission = typeof ROLE_PERMISSIONS[AdminRole][number]

// Permission checks
export function hasPermission(role: AdminRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role]
  return permissions.includes('*') || permissions.includes(permission)
}

export function checkPermission(
  role: AdminRole,
  requiredPermission: Permission
): { allowed: boolean; error?: string } {
  if (hasPermission(role, requiredPermission)) {
    return { allowed: true }
  }
  return {
    allowed: false,
    error: `Access denied: Permission '${requiredPermission}' required for role '${role}'`
  }
}

// Password utilities
export async function hashAdminPassword(password: string): Promise<string> {
  return hash(password, 12)
}

export async function verifyAdminPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword)
}

// Generate random password for password resets
export function generateRandomPassword(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Admin Session Management
interface AdminSessionPayload {
  adminId: string
  email: string
  role: AdminRole
  name: string
  // For impersonation
  impersonatingId?: string // If present, admin is viewing as this user
  impersonatingName?: string
  impersonatingRole?: string
}

export async function createAdminSession(
  admin: { id: string; email: string; role: AdminRole; name: string }
): Promise<string> {
  const secret = new TextEncoder().encode(SECRET_KEY)
  const token = await new SignJWT({
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
    name: admin.name
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)

  return token
}

export async function createImpersonationSession(
  admin: { id: string; email: string; role: AdminRole; name: string },
  targetUser: { id: string; name: string; role: string }
): Promise<{ token: string; expiresAt: Date }> {
  const secret = new TextEncoder().encode(SECRET_KEY)
  // Impersonation sessions expire after 30 minutes
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

  const token = await new SignJWT({
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
    name: admin.name,
    impersonatingId: targetUser.id,
    impersonatingName: targetUser.name,
    impersonatingRole: targetUser.role
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30m') // 30 minutes
    .sign(secret)

  return { token, expiresAt }
}

export async function verifyAdminSession(token: string): Promise<AdminSessionPayload | null> {
  try {
    const secret = new TextEncoder().encode(SECRET_KEY)
    const { payload } = await jwtVerify(token, secret)
    return payload as AdminSessionPayload
  } catch {
    return null
  }
}

export async function getAdminSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('adminSession')?.value

  if (token) {
    const session = await verifyAdminSession(token)

    if (session) {
      // Verify admin still exists and is active
      const admin = await db.admin.findUnique({
        where: { id: session.adminId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          forcePasswordChange: true
        }
      })

      if (admin && admin.status === 'ACTIVE') {
        return {
          ...session,
          forcePasswordChange: admin.forcePasswordChange
        }
      }
    }
  }

  // Fallback: check regular session if user has ADMIN or SUPER_ADMIN role
  const regularUser = await getSession()
  if (regularUser && (regularUser.role === 'ADMIN' || regularUser.role === 'SUPER_ADMIN')) {
    return {
      adminId: regularUser.id,
      email: regularUser.email,
      name: regularUser.name,
      role: regularUser.role as AdminRole,
      forcePasswordChange: false
    }
  }

  return null
}

export async function setAdminSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set('adminSession', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  })
}

export async function clearAdminSession() {
  const cookieStore = await cookies()
  cookieStore.delete('adminSession')
}

export async function requireAdminAuth() {
  const admin = await getAdminSession()
  if (!admin) {
    redirect('/admin/login')
  }
  return admin
}

export async function requireAdminPermission(requiredPermission: Permission) {
  const admin = await requireAdminAuth()
  const permissionCheck = checkPermission(admin.role as AdminRole, requiredPermission)

  if (!permissionCheck.allowed) {
    redirect('/admin/unauthorized')
  }

  return admin
}

export async function requireSuperAdmin() {
  const admin = await requireAdminAuth()
  if (admin.role !== 'SUPER_ADMIN') {
    redirect('/admin/unauthorized')
  }
  return admin
}

// Check if currently impersonating
export function isImpersonating(session: AdminSessionPayload): boolean {
  return !!session.impersonatingId
}

// Helper to get the effective user ID (impersonated user if impersonating, otherwise admin)
export function getEffectiveUserId(session: AdminSessionPayload): string {
  return session.impersonatingId || session.adminId
}

// Helper to check if write mode is enabled during impersonation
export function canWriteDuringImpersonation(session: AdminSessionPayload): boolean {
  // For now, impersonation is read-only by default
  // This can be expanded later with explicit write mode
  return !isImpersonating(session)
}

export type { AdminSessionPayload }
export type { AdminRole, AdminStatus }
