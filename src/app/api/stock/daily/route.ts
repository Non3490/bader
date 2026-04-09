import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { startOfDay, endOfDay } from 'date-fns'

export async function GET(req: Request) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date') // Optional: yyyy-mm-dd

    const query: any = {}
    if (user.role === 'SELLER') {
      query.product = { sellerId: user.id }
    }

    if (dateParam) {
      const d = new Date(dateParam)
      query.snapshotDate = {
        gte: startOfDay(d),
        lte: endOfDay(d)
      }
    }

    const snapshots = await db.stockSnapshot.findMany({
      where: query,
      include: {
        product: {
          select: { name: true, sku: true, seller: { select: { name: true } } }
        }
      },
      orderBy: [{ snapshotDate: 'desc' }, { product: { name: 'asc' } }],
      take: dateParam ? undefined : 100 // Return last 100 if no date specified
    })

    return NextResponse.json({ snapshots })
  } catch (error) {
    console.error('Fetch Snapshots Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
