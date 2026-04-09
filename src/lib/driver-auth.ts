/**
 * Driver Authentication System (PIN-based)
 * Separate from User/Admin auth - uses 4-6 digit PIN
 * 8-hour session expiry (one shift)
 */

import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { hash, compare } from 'bcryptjs'

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production')
}
const DRIVER_SECRET_KEY = process.env.JWT_SECRET || 'gabon-cod-platform-driver-secret-key-2024'
const DRIVER_SESSION_NAME = 'driver_session'
const DRIVER_SESSION_EXPIRY_HOURS = 8 // One shift

export async function hashPin(pin: string): Promise<string> {
  return hash(pin, 12)
}

export async function verifyPin(pin: string, hashedPin: string): Promise<boolean> {
  return compare(pin, hashedPin)
}

export async function createDriverSession(driverId: string): Promise<string> {
  const secret = new TextEncoder().encode(DRIVER_SECRET_KEY)
  const token = await new SignJWT({ driverId, type: 'driver' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DRIVER_SESSION_EXPIRY_HOURS}h`)
    .sign(secret)

  return token
}

export async function verifyDriverSession(token: string): Promise<{ driverId: string } | null> {
  try {
    const secret = new TextEncoder().encode(DRIVER_SECRET_KEY)
    const { payload } = await jwtVerify(token, secret)

    // Verify it's a driver token
    if (payload.type !== 'driver') {
      return null
    }

    return { driverId: payload.driverId as string }
  } catch {
    return null
  }
}

export async function getDriverSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(DRIVER_SESSION_NAME)?.value

  if (!token) {
    return null
  }

  const session = await verifyDriverSession(token)

  if (!session) {
    return null
  }

  const driver = await db.driver.findUnique({
    where: { id: session.driverId },
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      vehicleType: true,
      zone: true,
      isActive: true
    }
  })

  if (!driver || !driver.isActive) {
    return null
  }

  return driver
}

export async function setDriverSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(DRIVER_SESSION_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * DRIVER_SESSION_EXPIRY_HOURS,
    path: '/'
  })
}

export async function clearDriverSession() {
  const cookieStore = await cookies()
  cookieStore.delete(DRIVER_SESSION_NAME)
}

/**
 * Require authenticated driver - redirect to login if not authenticated
 */
export async function requireDriverAuth() {
  const driver = await getDriverSession()
  if (!driver) {
    throw new Error('DRIVER_NOT_AUTHENTICATED')
  }
  return driver
}

/**
 * Status transition rules for drivers
 */
export const DRIVER_STATUS_TRANSITIONS: Record<string, string[]> = {
  'OFFLINE': ['AVAILABLE', 'ON_DELIVERY'],
  'AVAILABLE': ['ON_DELIVERY', 'OFFLINE'],
  'ON_DELIVERY': ['AVAILABLE', 'OFFLINE']
}

/**
 * Validate if a driver status transition is allowed
 */
export function isValidDriverStatusTransition(currentStatus: string, newStatus: string): boolean {
  const allowed = DRIVER_STATUS_TRANSITIONS[currentStatus] || []
  return allowed.includes(newStatus)
}

/**
 * Update driver last seen timestamp
 */
export async function updateDriverLastSeen(driverId: string) {
  await db.driver.update({
    where: { id: driverId },
    data: { lastSeenAt: new Date() }
  })
}

/**
 * Get driver's current active deliveries count
 */
export async function getDriverActiveDeliveriesCount(driverId: string): Promise<number> {
  return db.delivery.count({
    where: {
      driverId,
      status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] }
    }
  })
}
