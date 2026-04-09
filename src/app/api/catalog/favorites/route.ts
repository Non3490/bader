import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/catalog/favorites — toggle favorite
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { catalogProductId } = await request.json()
    if (!catalogProductId) return NextResponse.json({ error: 'catalogProductId required' }, { status: 400 })

    const existing = await db.catalogFavorite.findUnique({
      where: { sellerId_catalogProductId: { sellerId: user.id, catalogProductId } }
    })

    if (existing) {
      await db.catalogFavorite.delete({ where: { id: existing.id } })
      return NextResponse.json({ favorited: false })
    } else {
      await db.catalogFavorite.create({ data: { sellerId: user.id, catalogProductId } })
      return NextResponse.json({ favorited: true })
    }
  } catch (error) {
    console.error('Catalog favorites error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
