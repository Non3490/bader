import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getStockSnapshots, getStockSnapshotsCSV, createDailySnapshots } from '@/lib/stock-snapshot'

// GET /api/stock-snapshots - fetch snapshots
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const productId = request.nextUrl.searchParams.get('productId')
    const startDate = request.nextUrl.searchParams.get('startDate')
    const endDate = request.nextUrl.searchParams.get('endDate')
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '30')
    const csv = request.nextUrl.searchParams.get('csv') === 'true'

    // CSV export
    if (csv && startDate && endDate) {
      const csvData = await getStockSnapshotsCSV(
        new Date(startDate),
        new Date(endDate)
      )
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="stock-snapshots-${startDate}-${endDate}.csv"`,
        },
      })
    }

    const snapshots = await getStockSnapshots({
      productId: productId || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    })

    // Filter based on user role
    const filteredSnapshots = user.role === 'ADMIN'
      ? snapshots
      : snapshots.filter(s => s.product.sellerId === user.id)

    return NextResponse.json({
      snapshots: filteredSnapshots.slice(0, limit).map(s => ({
        id: s.id,
        productId: s.productId,
        productName: s.product.name,
        sku: s.product.sku,
        seller: s.product.seller.name,
        date: s.date.toISOString(),
        snapshotDate: s.snapshotDate.toISOString(),
        initialStock: s.initialStock,
        inForDelivery: s.inForDelivery,
        outForDelivery: s.outForDelivery,
        finalStock: s.finalStock,
      }))
    })
  } catch (error) {
    console.error('Stock snapshots GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/stock-snapshots - create daily snapshots (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const result = await createDailySnapshots()
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Stock snapshots POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
