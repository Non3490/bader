import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hashPassword } from '@/lib/auth'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { ensureWallet } from '@/lib/wallet-service'
import { logActivity } from '@/lib/activity-logger'
import { withAuditContext } from '@/lib/api-context'

// GET /api/users - Admin only
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const role = searchParams.get('role')
    const search = searchParams.get('search')

    const where: Prisma.UserWhereInput = {}
    if (role && role !== 'ALL') where.role = role
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } }
      ]
    }

    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        zoneId: true,
        zone: {
          select: { name: true }
        },
        _count: { select: { ordersAsSeller: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      users: users.map(u => ({
        ...u,
        ordersCount: u._count.ordersAsSeller,
        createdAt: u.createdAt.toISOString()
      }))
    })
  } catch (error) {
    console.error('Users GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/users - Admin only (create user)
export async function POST(request: NextRequest) {
  return withAuditContext(async () => {
    try {
      const user = await getSession()
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      const body = await request.json()
      const { email, password, name, role, phone } = body

      if (!email || !password || !name || !role) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }

      const hashed = await hashPassword(password)
      const newUser = await db.user.create({
        data: { email: email.toLowerCase(), password: hashed, name, role, phone },
        select: { id: true, email: true, name: true, role: true, phone: true, isActive: true, createdAt: true }
      })

      if (newUser.role === 'SELLER') {
        try {
          await ensureWallet(newUser.id)
        } catch (walletErr) {
          console.error('Failed to create seller wallet:', walletErr)
          // Non-blocking: user is created, wallet can be created later
        }
      }

      // After creating the user, auto-create a Driver entity for DELIVERY role
      if (newUser.role === 'DELIVERY' && phone) {
        try {
          const { hashPin } = await import('@/lib/driver-auth')
          const existingDriver = await db.driver.findUnique({ where: { phone } })
          if (!existingDriver) {
            const defaultPin = phone.replace(/\D/g, '').slice(-4) || '1234'
            const hashedPin = await hashPin(defaultPin)
            await db.driver.create({
              data: {
                name,
                phone,
                pin: hashedPin,
                status: 'OFFLINE',
                isActive: true
              }
            })
          }
        } catch (driverErr) {
          console.error('Failed to auto-create Driver entity:', driverErr)
        }
      }

      logActivity(user.id, user.role, 'USER_CREATED', `Created ${role} — ${email}`).catch(() => {})

      return NextResponse.json({ user: newUser }, { status: 201 })
    } catch (error) {
      console.error('Users POST error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}
