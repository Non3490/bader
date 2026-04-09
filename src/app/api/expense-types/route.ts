import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

const DEFAULT_CALL_CENTER_EXPENSE_TYPES = [
  { id: 'default-transport', name: 'Transport', category: 'CALL_CENTER', description: 'Transport costs', isActive: true },
  { id: 'default-meals', name: 'Meals', category: 'CALL_CENTER', description: 'Meals and lunch', isActive: true },
  { id: 'default-call-minutes', name: 'Call Minutes', category: 'CALL_CENTER', description: 'Airtime and calling minutes', isActive: true },
  { id: 'default-internet', name: 'Internet', category: 'CALL_CENTER', description: 'Internet and data costs', isActive: true },
  { id: 'default-equipment', name: 'Equipment', category: 'CALL_CENTER', description: 'Equipment and office supplies', isActive: true },
  { id: 'default-other', name: 'Other', category: 'CALL_CENTER', description: 'Other operating expenses', isActive: true },
]

// GET /api/expense-types - List all expense types
export async function GET(request: Request) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'CALL_CENTER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    let expenseTypes = await db.expenseType.findMany({
      where: user.role === 'CALL_CENTER'
        ? { isActive: true, category: 'CALL_CENTER' }
        : undefined,
      orderBy: { name: 'asc' }
    })

    // Seed default CALL_CENTER expense types if none exist (SQLite doesn't support createMany skipDuplicates)
    if (user.role === 'CALL_CENTER' && expenseTypes.length === 0) {
      for (const t of DEFAULT_CALL_CENTER_EXPENSE_TYPES) {
        await db.expenseType.upsert({
          where: { id: t.id },
          update: {},
          create: {
            id: t.id,
            name: t.name,
            category: t.category,
            description: t.description,
            isActive: t.isActive
          }
        })
      }
      expenseTypes = await db.expenseType.findMany({
        where: { isActive: true, category: 'CALL_CENTER' },
        orderBy: { name: 'asc' }
      })
    }

    return NextResponse.json({ expenseTypes })
  } catch (error) {
    console.error('Get expense types error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/expense-types - Create new expense type
export async function POST(request: Request) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { name, category, description } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!category || !['CALL_CENTER', 'SOURCING', 'AD_SPEND', 'OTHER'].includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    const expenseType = await db.expenseType.create({
      data: {
        name: name.trim(),
        category,
        description: description?.trim() || null,
        isActive: true
      }
    })

    await logActivity(user.id, user.role, 'EXPENSE_TYPE_CREATED', `Expense type "${name}" created in ${category}`)

    return NextResponse.json({ expenseType }, { status: 201 })
  } catch (error) {
    console.error('Create expense type error:', error)
    return NextResponse.json({ error: 'Failed to create expense type' }, { status: 500 })
  }
}

// PUT /api/expense-types - Update expense type
export async function PUT(request: Request) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, category, description } = body

    if (!id) {
      return NextResponse.json({ error: 'Expense type ID is required' }, { status: 400 })
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const expenseType = await db.expenseType.update({
      where: { id },
      data: {
        name: name.trim(),
        category,
        description: description?.trim() || null
      }
    })

    await logActivity(user.id, user.role, 'EXPENSE_TYPE_UPDATED', `Expense type "${name}" updated`)

    return NextResponse.json({ expenseType })
  } catch (error) {
    console.error('Update expense type error:', error)
    return NextResponse.json({ error: 'Failed to update expense type' }, { status: 500 })
  }
}
