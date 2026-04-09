import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-logger'

// GET /api/catalog — list active catalog products (all roles)
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const category = request.nextUrl.searchParams.get('category')
    const search = request.nextUrl.searchParams.get('search')

    const where: Record<string, unknown> = { isActive: true }
    if (category) where.category = category
    if (search) where.name = { contains: search }

    const products = await db.catalogProduct.findMany({
      where,
      include: {
        favorites: user.role === 'SELLER'
          ? { where: { sellerId: user.id }, select: { id: true } }
          : false
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      products: products.map(p => ({
        ...p,
        isFavorited: user.role === 'SELLER' ? (p.favorites as { id: string }[]).length > 0 : false,
        favorites: undefined
      }))
    })
  } catch (error) {
    console.error('Catalog GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/catalog — admin creates catalog product
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, imageUrl, costPrice, category, countryAvailable } = body

    if (!name || costPrice == null) {
      return NextResponse.json({ error: 'name and costPrice are required' }, { status: 400 })
    }

    const product = await db.catalogProduct.create({
      data: { name, description, imageUrl, costPrice: parseFloat(costPrice), category, countryAvailable }
    })

    logActivity(user.id, user.role, 'CATALOG_PRODUCT_CREATED', name).catch(() => {})

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('Catalog POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
