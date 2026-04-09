import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { getStockAlerts, getStockValuation, getMovementAnalysis, getWasteReport } from '@/lib/stock-service'

/**
 * GET /api/admin/inventory/reports - Get various inventory reports
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') // 'alerts' | 'valuation' | 'movement' | 'waste'
    const sellerId = searchParams.get('sellerId')

    switch (type) {
      case 'alerts': {
        const alerts = await getStockAlerts(sellerId || undefined)
        return NextResponse.json(alerts)
      }

      case 'valuation': {
        const valuation = await getStockValuation(sellerId || undefined)
        return NextResponse.json(valuation)
      }

      case 'movement': {
        const movement = await getMovementAnalysis(sellerId || undefined)
        return NextResponse.json(movement)
      }

      case 'waste': {
        const waste = await getWasteReport(sellerId || undefined, 3)
        return NextResponse.json(waste)
      }

      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Inventory reports error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
