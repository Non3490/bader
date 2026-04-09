import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { compare } from 'bcryptjs'
import { SignJWT } from 'jose'
import { logAdminLogin, logFailedLogin } from '@/lib/audit-logger'

export const runtime = 'nodejs'

const SECRET_KEY = process.env.JWT_SECRET || 'gabon-cod-platform-secret-key-2024'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const admin = await db.admin.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (!admin) {
      await logFailedLogin(email)
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    if (admin.status !== 'ACTIVE') {
      await logFailedLogin(email)
      return NextResponse.json(
        { error: 'Account is ' + admin.status.toLowerCase() + '. Please contact administrator.' },
        { status: 403 }
      )
    }

    const isValid = await compare(password, admin.password)

    if (!isValid) {
      await logFailedLogin(email)
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const token = await new SignJWT({
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
      name: admin.name
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(SECRET_KEY))

    await db.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() }
    }).catch((error) => {
      console.error('Failed to update admin last login timestamp:', error)
    })

    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        forcePasswordChange: admin.forcePasswordChange
      }
    })

    response.cookies.set('adminSession', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    })

    // Best-effort logging: do not fail login if audit logging breaks.
    logAdminLogin(admin.id, admin.name, admin.role).catch((error) => {
      console.error('Admin login audit logging failed:', error)
    })

    return response
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
