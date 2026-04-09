import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { logActivity } from '@/lib/activity-logger'
import { sendTeamInviteEmail } from '@/lib/email-service'

// GET /api/team — seller gets their sub-users
export async function GET() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!['SELLER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const members = await db.user.findMany({
      where: { parentSellerId: user.id },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true }
    })

    return NextResponse.json({ members })
  } catch (error) {
    console.error('Team GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/team — seller invites a CALL_CENTER sub-user
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!['SELLER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { email, password, name, role } = await request.json()
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'email, password, name are required' }, { status: 400 })
    }

    const allowedRoles = ['CALL_CENTER', 'DELIVERY']
    const assignedRole = allowedRoles.includes(role) ? role : 'CALL_CENTER'

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

    const hashed = await hashPassword(password)
    const member = await db.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashed,
        name,
        role: assignedRole,
        parentSellerId: user.id
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true }
    })

    // Send invitation email
    await sendTeamInviteEmail(
      email.toLowerCase(),
      name,
      user.name,
      password
    ).catch(err => {
      console.error('Failed to send invitation email:', err)
    })

    logActivity(user.id, user.role, 'TEAM_MEMBER_ADDED', `${assignedRole} — ${email}`).catch(() => {})

    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    console.error('Team POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
