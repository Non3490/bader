import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { startOfDay, endOfDay, subDays } from 'date-fns'

// This endpoint should be hit by a cron service (like Vercel Cron, GitHub Actions, AWS EventBridge) daily at 23:59
export async function POST(req: Request) {
  try {
    // Optionally secure with a secret header
    const authHeader = req.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    const start = startOfDay(today)
    const end = endOfDay(today)

    const products = await db.product.findMany({
      include: {
        stocks: {
          include: {
            movements: {
              where: {
                createdAt: {
                  gte: start,
                  lte: end
                }
              }
            }
          }
        }
      }
    })

    const snapshots = []

    for (const prod of products) {
      let finalStock = 0
      let inForDelivery = 0
      let outForDelivery = 0

      for (const stock of prod.stocks) {
        finalStock += stock.quantity
        
        for (const mv of stock.movements) {
          if (mv.type === 'IN' || mv.type === 'RETURN') {
            inForDelivery += mv.quantity
          } else if (mv.type === 'OUT') {
            outForDelivery += mv.quantity
          }
        }
      }

      // Calculate initial based on final and movements
      const initialStock = finalStock - inForDelivery + outForDelivery

      const snapshot = await db.stockSnapshot.upsert({
        where: {
          productId_snapshotDate: {
            productId: prod.id,
            snapshotDate: start
          }
        },
        update: {
          initialStock,
          inForDelivery,
          outForDelivery,
          finalStock,
          date: today
        },
        create: {
          productId: prod.id,
          date: today,
          snapshotDate: start,
          initialStock,
          inForDelivery,
          outForDelivery,
          finalStock
        }
      })

      snapshots.push(snapshot)
    }

    return NextResponse.json({ success: true, count: snapshots.length, snapshots })
  } catch (error) {
    console.error('Snapshot Cron Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
