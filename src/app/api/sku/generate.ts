import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { generateSKU, CATEGORIES, CATEGORY_PREFIXES } from '@/lib/sku-generator'

// GET /api/sku/generate?category=X
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const category = request.nextUrl.searchParams.get('category') || 'other'

    // Validate category
    if (!CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    const sku = await generateSKU(category, user.id)

    return NextResponse.json({
      sku,
      category,
      prefix: CATEGORY_PREFIXES[category],
    })
  } catch (error) {
    console.error('SKU generate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
